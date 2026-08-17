import { describe, expect, it } from "vitest";
import { buildDeck, shuffle } from "../deck";
import { dealHands } from "../deal";
import { applyMove, getPlayableSquares, hasLegalMove } from "../moves";
import { buildSeating, type SeatPlayerInput } from "../turnOrder";
import type {
  BoardChips,
  CardInstance,
  ChipColor,
  Move,
  MoveAction,
  PlayerId,
  SequenceRecord,
  SquareIndex,
} from "../types";
import { checkWinner, resolveStalemateWinners } from "../winCondition";

// Deterministic RNG so a failure is reproducible instead of a flaky,
// unrepeatable one-in-N-runs failure.
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plays out an entire game with a non-strategic bot (always takes the
// first legal move available; clears dead cards via swap first) to
// prove the game as a whole always reaches an end state — either a real
// win via sequencesToWin, or, since a non-strategic bot is very unlikely
// to complete a sequence before the 104-card deck runs dry, the
// stalemate path this fix adds. This is exactly the shape of the
// reported bug: a game that grinds on with nobody completing a second
// sequence until the deck runs out.
function playFullGame(mode: "two-player" | "three-player" | "two-team", seed: number) {
  const seatInputs: Record<typeof mode, SeatPlayerInput[]> = {
    "two-player": [
      { id: "p1", displayName: "P1", chipColor: "red" },
      { id: "p2", displayName: "P2", chipColor: "blue" },
    ],
    "three-player": [
      { id: "p1", displayName: "P1", chipColor: "red" },
      { id: "p2", displayName: "P2", chipColor: "blue" },
      { id: "p3", displayName: "P3", chipColor: "green" },
    ],
    "two-team": [
      { id: "a1", displayName: "A1", chipColor: "red", team: "A" },
      { id: "a2", displayName: "A2", chipColor: "red", team: "A" },
      { id: "b1", displayName: "B1", chipColor: "blue", team: "B" },
      { id: "b2", displayName: "B2", chipColor: "blue", team: "B" },
    ],
  } as const;
  const handSize = mode === "two-player" ? 7 : 6;
  const sequencesToWin = 2;

  const players = buildSeating(mode, seatInputs[mode]);
  const rng = mulberry32(seed);
  let deck = shuffle(buildDeck(), rng);
  const { hands: initialHands, remainingDeck } = dealHands(
    deck,
    players.map((p) => p.id),
    handSize,
  );
  let hands: Record<PlayerId, CardInstance[]> = initialHands;
  deck = remainingDeck;

  let board: BoardChips = {};
  let sequences: SequenceRecord[] = [];
  let sequenceUsage: Partial<Record<SquareIndex, number>> = {};
  let currentSeatIndex = 0;
  let turnNumber = 0;
  let winner: ChipColor[] | null = null;

  const MAX_TURNS = 5000; // generous — a real game never comes close
  let guard = 0;

  while (!winner) {
    guard++;
    if (guard > MAX_TURNS) {
      throw new Error("simulation exceeded max turns — the game deadlocked");
    }

    const player = players[currentSeatIndex];

    // Clear out dead cards first, same as a player manually discarding
    // them before playing — bounded by hand size so this can't spin
    // forever even if something upstream is broken.
    for (let i = 0; i <= (hands[player.id]?.length ?? 0); i++) {
      const hand = hands[player.id] ?? [];
      const deadIndex = hand.findIndex(
        (c) => getPlayableSquares(c, board, sequenceUsage, player.chipColor) === null,
      );
      if (deadIndex === -1) break;
      const withoutCard = hand.filter((_, idx) => idx !== deadIndex);
      const [drawn, ...rest] = deck;
      hands = { ...hands, [player.id]: drawn ? [...withoutCard, drawn] : withoutCard };
      deck = drawn ? rest : deck;
    }

    const hand = hands[player.id] ?? [];
    if (!hasLegalMove(hand, board, sequenceUsage, player.chipColor)) {
      // The only way a hand fully cleared of dead cards can still have
      // no legal move is a two-eyed jack with no open square, or a
      // one-eyed jack with nothing removable — either way the deck must
      // also be exhausted, or a dead-card swap would still have been an
      // option moments ago.
      expect(deck.length).toBe(0);
      winner = resolveStalemateWinners(players, sequences);
      break;
    }

    let chosen: { card: CardInstance; action: MoveAction } | null = null;
    for (const card of hand) {
      const targets = getPlayableSquares(card, board, sequenceUsage, player.chipColor);
      if (targets && targets.squares.length > 0) {
        chosen = {
          card,
          action:
            targets.action === "remove-opponent"
              ? { type: "remove-opponent", square: targets.squares[0] }
              : { type: "place", square: targets.squares[0] },
        };
        break;
      }
    }
    if (!chosen) throw new Error("hasLegalMove said yes but no card produced a target");

    const move: Move = { playerId: player.id, card: chosen.card, action: chosen.action };
    const applied = applyMove({
      board,
      sequences,
      sequenceUsage,
      currentSeatIndex,
      playerCount: players.length,
      turnNumber,
      move,
      actingChipColor: player.chipColor,
    });
    board = applied.board;
    sequences = applied.sequences;
    sequenceUsage = applied.sequenceUsage;
    currentSeatIndex = applied.currentSeatIndex;
    turnNumber = applied.turnNumber;

    const withoutCard = hand.filter((c) => c.instanceId !== chosen!.card.instanceId);
    const [drawn, ...rest] = deck;
    hands = { ...hands, [player.id]: drawn ? [...withoutCard, drawn] : withoutCard };
    deck = drawn ? rest : deck;

    const immediateWinner = checkWinner(players, sequences, sequencesToWin);
    if (immediateWinner) {
      winner = [immediateWinner];
      break;
    }

    // Mirrors the reactive stalemate check in hooks/useGame.ts / app/page.tsx:
    // evaluated for whoever's turn it now is, not just the player who just moved.
    const nextPlayer = players[currentSeatIndex];
    const nextHand = hands[nextPlayer.id] ?? [];
    if (deck.length === 0 && !hasLegalMove(nextHand, board, sequenceUsage, nextPlayer.chipColor)) {
      winner = resolveStalemateWinners(players, sequences);
      break;
    }
  }

  return { winner, sequences, players, turns: turnNumber };
}

describe("full-game stalemate simulation", () => {
  const modes = ["two-player", "three-player", "two-team"] as const;

  for (const mode of modes) {
    it(`${mode}: always reaches a resolved end state, never deadlocks (20 seeded trials)`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const { winner, sequences, players } = playFullGame(mode, seed);

        expect(winner).not.toBeNull();
        expect(Array.isArray(winner)).toBe(true);

        // Whatever we ended on is consistent with either an outright
        // sequencesToWin finish or the sequence-count leaders at the
        // point nobody could move any further.
        const outrightWinner = checkWinner(players, sequences, 2);
        if (outrightWinner) {
          expect(winner).toEqual([outrightWinner]);
        } else {
          expect([...winner!].sort()).toEqual(
            [...resolveStalemateWinners(players, sequences)].sort(),
          );
        }
      }
    });
  }
});
