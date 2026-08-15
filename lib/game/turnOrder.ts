import type { GameMode, PlayerId, PlayerMeta, Team } from "./types";

export interface SeatPlayerInput {
  id: PlayerId;
  displayName: string;
  chipColor: PlayerMeta["chipColor"];
  team?: Team;
}

// Builds turn order once, at game start. For two-team mode this interleaves
// seats between teams (TeamA-P1, TeamB-P1, TeamA-P2, TeamB-P2, ...); other
// modes just keep input order. Every other piece of turn logic
// (getNextSeatIndex) never needs to know about teams — it's always just
// "next index, wrapping" — because the alternation is baked in here, once.
export function buildSeating(
  mode: GameMode,
  players: readonly SeatPlayerInput[],
): PlayerMeta[] {
  let ordered: readonly SeatPlayerInput[];

  if (mode === "two-team") {
    const teamA = players.filter((p) => p.team === "A");
    const teamB = players.filter((p) => p.team === "B");
    const interleaved: SeatPlayerInput[] = [];
    const maxLen = Math.max(teamA.length, teamB.length);
    for (let i = 0; i < maxLen; i++) {
      if (teamA[i]) interleaved.push(teamA[i]);
      if (teamB[i]) interleaved.push(teamB[i]);
    }
    ordered = interleaved;
  } else {
    ordered = players;
  }

  return ordered.map((p, seatIndex) => ({
    id: p.id,
    displayName: p.displayName,
    seatIndex,
    team: p.team ?? null,
    chipColor: p.chipColor,
  }));
}

export function getNextSeatIndex(
  currentSeatIndex: number,
  playerCount: number,
): number {
  return (currentSeatIndex + 1) % playerCount;
}
