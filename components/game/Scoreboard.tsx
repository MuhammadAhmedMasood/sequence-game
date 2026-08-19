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
  red: "bg-gradient-to-br from-chip-red to-chip-red-strong",
  blue: "bg-gradient-to-br from-chip-blue to-chip-blue-strong",
  green: "bg-gradient-to-br from-chip-green to-chip-green-strong",
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
                ? "border-gold-500/70 bg-gold-200/30 text-panel-ink"
                : "border-panel-border bg-panel text-panel-ink-soft"
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-chip ${CHIP_DOT_CLASSES[e.color]}`} />
            <span className="truncate" title={e.sublabel}>
              {e.label}
              {e.sublabel ? <span className="text-panel-ink-soft"> · {e.sublabel}</span> : null}
            </span>
            <span className="font-mono text-[0.7rem] text-panel-ink-soft">
              {e.count}/{sequencesToWin}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-44 shrink-0 flex-col gap-2 rounded-panel border border-panel-border bg-panel p-3 text-xs text-panel-ink-soft shadow-panel backdrop-blur-sm">
      <p className="text-sm font-semibold text-panel-ink">Score</p>
      {entries.map((e) => (
        <div
          key={e.key}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
            e.isMine ? "bg-gold-200/25" : ""
          }`}
        >
          <span className={`h-3 w-3 shrink-0 rounded-full shadow-chip ${CHIP_DOT_CLASSES[e.color]}`} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-panel-ink">
              {e.label}
              {e.isMine ? " (you)" : ""}
            </span>
            {e.sublabel ? (
              <span className="truncate text-[0.65rem] text-panel-ink-soft" title={e.sublabel}>
                {e.sublabel}
              </span>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center gap-0.5" title={`${e.count}/${sequencesToWin} sequences`}>
            {Array.from({ length: sequencesToWin }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < e.count ? CHIP_DOT_CLASSES[e.color] : "bg-card-border"
                }`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
