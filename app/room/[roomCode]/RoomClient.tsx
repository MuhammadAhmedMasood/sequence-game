"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Board from "@/components/board/Board";
import JackHelpButton from "@/components/game/JackHelpButton";
import JackLegend from "@/components/game/JackLegend";
import Scoreboard from "@/components/game/Scoreboard";
import Hand from "@/components/hand/Hand";
import WaitingRoom from "@/components/lobby/WaitingRoom";
import { useGame } from "@/hooks/useGame";
import { playTurnChime } from "@/lib/audio/chime";
import { isDeadCard } from "@/lib/game/deadCard";
import { isJack } from "@/lib/game/jacks";
import { getPlayableSquares } from "@/lib/game/moves";
import type { CardInstance, ChipColor, MoveAction, SquareIndex, Team } from "@/lib/game/types";
import { supabase } from "@/lib/supabase/client";
import { rematchGame, setTeam, startGame, swapPlayerTeams } from "@/lib/supabase/queries";

interface RoomClientProps {
  roomCode: string;
}

const CHIP_DOT_CLASSES: Record<ChipColor, string> = {
  red: "bg-gradient-to-br from-chip-red to-chip-red-strong",
  blue: "bg-gradient-to-br from-chip-blue to-chip-blue-strong",
  green: "bg-gradient-to-br from-chip-green to-chip-green-strong",
};

const CHIP_LABELS: Record<ChipColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
};

export default function RoomClient({ roomCode }: RoomClientProps) {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("games")
      .select("id")
      .eq("room_code", roomCode.toUpperCase())
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLookupError("Room not found.");
          return;
        }
        setGameId(data.id);
        // So the landing page can offer "rejoin" even if this tab was
        // opened via a shared link rather than the create/join panel.
        localStorage.setItem("sequence:lastRoomCode", roomCode.toUpperCase());
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const {
    loading,
    error,
    game,
    players,
    myPlayerId,
    myHand,
    isSubmitting,
    playMove,
    swapDeadCard,
  } = useGame(gameId);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hintsDraft, setHintsDraft] = useState(true);
  const [sequencesToWinDraft, setSequencesToWinDraft] = useState(2);
  const [rematching, setRematching] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.seatIndex === 0;
  const selectedCard = myHand.find((c) => c.instanceId === selectedInstanceId);

  const selectedTargets =
    selectedCard && game && myPlayer
      ? getPlayableSquares(selectedCard, game.board_chips, game.sequence_usage, myPlayer.chipColor)
      : null;
  const selectedSquares = useMemo(
    () => new Set<SquareIndex>(selectedTargets?.squares ?? []),
    [selectedTargets],
  );

  // Jacks are excluded here for the same reason as the local demo: a
  // two-eyed jack matches every open square, so including it in the
  // ambient hint would flood the whole board green. It's still fully
  // playable — see the jack-priority branch in handleSquareClick below.
  const hintSquares = useMemo(() => {
    const squares = new Set<SquareIndex>();
    if (!game?.hints_enabled || !myPlayer) return squares;
    for (const card of myHand) {
      if (isJack(card)) continue;
      const targets = getPlayableSquares(card, game.board_chips, game.sequence_usage, myPlayer.chipColor);
      targets?.squares.forEach((s) => squares.add(s));
    }
    return squares;
  }, [game?.hints_enabled, game?.board_chips, game?.sequence_usage, myHand, myPlayer]);

  const selectedCardIsDead =
    selectedCard && game ? isDeadCard(selectedCard, game.board_chips) : false;

  const isMyTurn = !!(game && myPlayer && game.current_seat_index === myPlayer.seatIndex);
  const currentTurnPlayer = players.find((p) => p.seatIndex === game?.current_seat_index);
  const turnLabel =
    game?.mode === "two-team" && currentTurnPlayer
      ? `Team ${currentTurnPlayer.team}'s turn (${currentTurnPlayer.displayName})`
      : currentTurnPlayer
        ? `${currentTurnPlayer.displayName}'s turn`
        : "Waiting for opponent…";

  // Chimes once on the moment it *becomes* your turn (including the very
  // first turn of the game) — not on every render while it stays your
  // turn, and not during the lobby/loading views.
  const wasMyTurnRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== "in_progress" || game.winner) return;
    if (isMyTurn && !wasMyTurnRef.current) {
      playTurnChime();
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, game?.status, game?.winner]);

  // game.winner: null = not over, [] = draw, 1+ colors = win (more than
  // one means a tie for the lead at a stalemate — see
  // resolveStalemateWinners in lib/game/winCondition.ts).
  const winningLabel = (() => {
    if (!game?.winner) return null;
    if (game.winner.length === 0) return "It's a draw!";
    const winners = players.filter((p) => game.winner!.includes(p.chipColor));
    const names =
      game.mode === "two-team"
        ? [...new Set(winners.map((p) => `Team ${p.team}`))]
        : winners.map((p) => p.displayName);
    return names.length > 1 ? `${names.join(" & ")} tie!` : `${names[0] ?? "Someone"} wins!`;
  })();

  function handleSquareClick(index: SquareIndex) {
    // Blocks a rushed double-click: the board round-trips over the
    // network, so `game` is briefly stale right after a move is sent —
    // a second click in that window would validate against that stale
    // state and could submit a bogus or duplicate move.
    if (isSubmitting) return;
    if (!game || !myPlayer || game.winner || !isMyTurn) return;

    if (selectedCard && selectedTargets?.squares.includes(index)) {
      const action: MoveAction =
        selectedTargets.action === "remove-opponent"
          ? { type: "remove-opponent", square: index }
          : { type: "place", square: index };
      playMove(selectedCard, action);
      setSelectedInstanceId(null);
      return;
    }

    // Jacks are unambiguous — wild or anti-wild — so clicking one of
    // their legal squares plays them even without pre-selecting,
    // regardless of the hints setting. Non-jack cards only get this
    // without-selecting convenience when hints are on.
    const pool: CardInstance[] = game.hints_enabled ? myHand : myHand.filter(isJack);
    const candidates = pool
      .map((card) => ({
        card,
        targets: getPlayableSquares(card, game.board_chips, game.sequence_usage, myPlayer.chipColor),
      }))
      .filter((c) => c.targets?.squares.includes(index));
    if (candidates.length === 0) return;

    const preferred = candidates.find((c) => !isJack(c.card)) ?? candidates[0];
    const action: MoveAction =
      preferred.targets!.action === "remove-opponent"
        ? { type: "remove-opponent", square: index }
        : { type: "place", square: index };
    playMove(preferred.card, action);
    setSelectedInstanceId(null);
  }

  function handleSetTeam(team: Team) {
    if (!myPlayerId) return;
    setTeam(myPlayerId, team).catch((e) => {
      console.error("Failed to switch team", e);
    });
  }

  function handleSwapTeam(otherPlayerId: string) {
    if (!myPlayerId) return;
    swapPlayerTeams(myPlayerId, otherPlayerId).catch((e) => {
      console.error("Failed to swap teams", e);
    });
  }

  async function handleStart() {
    if (!game) return;
    setStarting(true);
    try {
      await startGame(game.id, hintsDraft, sequencesToWinDraft);
    } finally {
      setStarting(false);
    }
  }

  async function handleRematch(resetTeams: boolean) {
    if (!game) return;
    setRematching(true);
    try {
      await rematchGame(game.id, resetTeams);
    } catch (e) {
      console.error("Failed to start rematch", e);
    } finally {
      setRematching(false);
    }
  }

  function handleExit() {
    router.push("/");
  }

  if (lookupError) {
    return (
      <main className="bg-felt flex h-dvh items-center justify-center text-felt-ink">
        {lookupError}
      </main>
    );
  }
  if (loading || !game) {
    return (
      <main className="bg-felt flex h-dvh items-center justify-center text-felt-ink/80">
        Loading room {roomCode}…
      </main>
    );
  }

  if (game.status === "lobby") {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        mode={game.mode}
        players={players}
        isHost={isHost}
        myPlayerId={myPlayerId}
        onSetTeam={handleSetTeam}
        onSwapTeam={handleSwapTeam}
        hintsDraft={hintsDraft}
        onHintsChange={setHintsDraft}
        sequencesToWinDraft={sequencesToWinDraft}
        onSequencesToWinChange={setSequencesToWinDraft}
        onStart={handleStart}
        starting={starting}
      />
    );
  }

  return (
    <main className="bg-felt flex h-dvh w-full flex-col items-center gap-2 overflow-hidden p-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:p-4">
      <div className="flex w-full max-w-4xl shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight text-felt-ink sm:text-lg">
            Room <span className="font-mono tracking-widest text-gold-300">{game.room_code}</span>
          </h1>
          {myPlayer ? (
            <span className="flex items-center gap-1.5 rounded-full border border-panel-border bg-panel px-2 py-0.5 text-xs font-medium text-panel-ink">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-chip ${CHIP_DOT_CLASSES[myPlayer.chipColor]}`} />
              You: {CHIP_LABELS[myPlayer.chipColor]}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {game.winner ? (
            <span className="text-sm font-medium text-felt-ink/70">Game over</span>
          ) : isMyTurn ? (
            <span className="animate-glow-breathe rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-xs font-bold text-ink-fixed shadow-card sm:text-sm">
              Your turn!
            </span>
          ) : (
            <span className="rounded-full border border-panel-border bg-panel px-3 py-1 text-xs font-medium text-panel-ink-soft sm:text-sm">
              {turnLabel}
            </span>
          )}
          <JackHelpButton />
        </div>
      </div>

      <div className="w-full max-w-4xl shrink-0 lg:hidden">
        <Scoreboard
          compact
          mode={game.mode}
          players={players}
          sequences={game.sequences}
          sequencesToWin={game.sequences_to_win}
          myPlayerId={myPlayerId}
        />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-300">{error}</p> : null}

      {game.winner ? (
        <div className="animate-fade-slide-up flex w-full max-w-sm shrink-0 flex-col items-center gap-3 rounded-panel border border-gold-500/40 bg-gradient-to-b from-gold-200 to-parchment p-5 text-center shadow-panel">
          <p className="bg-gradient-to-r from-gold-600 to-gold-700 bg-clip-text text-xl font-extrabold text-transparent">
            {winningLabel ?? "Game over!"}
          </p>
          {isHost ? (
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                disabled={rematching}
                onClick={() => handleRematch(false)}
                className="w-full rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 py-2.5 text-sm font-semibold text-ink-fixed shadow-card transition hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rematching ? "Starting…" : "Play again"}
              </button>
              {game.mode === "two-team" ? (
                <button
                  type="button"
                  disabled={rematching}
                  onClick={() => handleRematch(true)}
                  className="w-full rounded-xl border border-ink-fixed/20 py-2.5 text-sm font-semibold text-ink-fixed transition hover:bg-ink-fixed/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rematching ? "Starting…" : "Shuffle teams & play again"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-fixed-soft">Waiting for the host to start a rematch…</p>
          )}
          <button
            type="button"
            onClick={handleExit}
            className="text-sm text-ink-fixed-soft underline underline-offset-2 hover:text-gold-700"
          >
            Exit to home
          </button>
        </div>
      ) : selectedCardIsDead ? (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-red-suit/30 bg-red-suit/10 px-3 py-1 text-sm text-red-suit">
          This card is dead.
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => selectedCard && swapDeadCard(selectedCard)}
            className="rounded bg-red-suit px-2 py-0.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Discard &amp; draw
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-4">
        <Board
          chips={game.board_chips}
          selectedSquares={selectedSquares}
          hintSquares={hintSquares}
          sequences={game.sequences}
          playerColor={myPlayer?.chipColor ?? "red"}
          onSquareClick={handleSquareClick}
        />

        <div className="hidden w-44 shrink-0 flex-col gap-4 self-center lg:flex">
          <Scoreboard
            mode={game.mode}
            players={players}
            sequences={game.sequences}
            sequencesToWin={game.sequences_to_win}
            myPlayerId={myPlayerId}
          />
          <JackLegend />
        </div>
      </div>

      <div className="w-full max-w-4xl shrink-0 rounded-panel border border-panel-border bg-panel p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-panel backdrop-blur-sm">
        <Hand
          cards={myHand}
          selectedInstanceId={selectedInstanceId}
          onSelect={(id) => setSelectedInstanceId((cur) => (cur === id ? null : id))}
        />
      </div>
    </main>
  );
}
