import type { ChipColor, GameMode, PlayerMeta, SequenceRecord, Team } from "@/lib/game/types";

interface ScoreboardProps {
  mode: GameMode;
  players: PlayerMeta[];
  sequences: SequenceRecord[];
  sequencesToWin: number;
  myPlayerId: string | null;
  // Compact renders a wrapping row of pill chips (used on narrow
  // viewports, where the full card-style board below doesn't fit
  // alongside the game); the default is the fuller sidebar card shown
  // next to the board on wide screens.
  compact?: boolean;
}

const CHIP_DOT_CLASSES: Record<ChipColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

interface ScoreEntry {
  key: string;
  label: string;
  sublabel?: string;
  color: ChipColor;
  count: number;
  isMine: boolean;
}

function buildEntries(
  mode: GameMode,
  players: PlayerMeta[],
  sequences: SequenceRecord[],
  myPlayerId: string | null,
): ScoreEntry[] {
  const counts: Partial<Record<ChipColor, number>> = {};
  for (const seq of sequences) {
    counts[seq.owner] = (counts[seq.owner] ?? 0) + 1;
  }

  // Team sequences belong to the shared team chip color, not an
  // individual — one row per team rather than per player.
  if (mode === "two-team") {
    const teams: Team[] = ["A", "B"];
    return teams.map((team) => {
      const teamPlayers = players.filter((p) => p.team === team);
      const color: ChipColor = teamPlayers[0]?.chipColor ?? (team === "A" ? "red" : "blue");
      return {
        key: `team-${team}`,
        label: `Team ${team}`,
        sublabel: teamPlayers.map((p) => p.displayName).join(" & "),
        color,
        count: counts[color] ?? 0,
        isMine: teamPlayers.some((p) => p.id === myPlayerId),
      };
    });
  }

  return players.map((p) => ({
    key: p.id,
    label: p.displayName,
    color: p.chipColor,
    count: counts[p.chipColor] ?? 0,
    isMine: p.id === myPlayerId,
  }));
}

export default function Scoreboard({
  mode,
  players,
  sequences,
  sequencesToWin,
  myPlayerId,
  compact = false,
}: ScoreboardProps) {
  const entries = buildEntries(mode, players, sequences, myPlayerId);

  if (compact) {
    return (
      <div className="flex w-full max-w-4xl flex-wrap items-center gap-1.5">
        {entries.map((e) => (
          <span
            key={e.key}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              e.isMine
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-zinc-200 bg-white/70 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300"
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[e.color]}`} />
            <span className="truncate" title={e.sublabel}>
              {e.label}
              {e.sublabel ? <span className="text-zinc-400"> · {e.sublabel}</span> : null}
            </span>
            <span className="font-mono text-[0.7rem] text-zinc-400">
              {e.count}/{sequencesToWin}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-44 shrink-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-white/90 p-3 text-xs text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Score</p>
      {entries.map((e) => (
        <div
          key={e.key}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
            e.isMine ? "bg-indigo-50 dark:bg-indigo-950/60" : ""
          }`}
        >
          <span className={`h-3 w-3 shrink-0 rounded-full ${CHIP_DOT_CLASSES[e.color]}`} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
              {e.label}
              {e.isMine ? " (you)" : ""}
            </span>
            {e.sublabel ? (
              <span className="truncate text-[0.65rem] text-zinc-400" title={e.sublabel}>
                {e.sublabel}
              </span>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center gap-0.5" title={`${e.count}/${sequencesToWin} sequences`}>
            {Array.from({ length: sequencesToWin }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < e.count ? CHIP_DOT_CLASSES[e.color] : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
