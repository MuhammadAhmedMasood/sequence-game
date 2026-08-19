// Shared by the desktop sidebar panel and the mobile help popover so the
// two explanations of two-eyed vs. one-eyed jacks can't drift apart.
export function JackLegendRows() {
  return (
    <>
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG */}
        <img
          src="/cards/jack-clubs.svg"
          alt="Two-eyed jack"
          className="mt-0.5 h-10 w-auto shrink-0 rounded-card border border-card-border bg-card-face shadow-card"
        />
        <span>Two-eyed jack (both eyes) — wild, place anywhere</span>
      </div>
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static SVG */}
        <img
          src="/cards/jack-hearts.svg"
          alt="One-eyed jack"
          className="mt-0.5 h-10 w-auto shrink-0 rounded-card border border-card-border bg-card-face shadow-card"
        />
        <span>One-eyed jack (profile) — anti-wild, remove one opponent chip</span>
      </div>
    </>
  );
}

export default function JackLegend() {
  return (
    <div className="hidden w-44 shrink-0 flex-col gap-3 self-center rounded-panel border border-panel-border bg-panel p-3 text-xs text-panel-ink-soft shadow-panel backdrop-blur-sm lg:flex">
      <p className="text-sm font-semibold text-panel-ink">Jack cards</p>
      <JackLegendRows />
    </div>
  );
}
