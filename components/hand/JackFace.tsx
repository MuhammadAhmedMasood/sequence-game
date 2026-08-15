// Original, simplified jack illustrations — not a copy of any reference
// card. Profile view (one eye visible) for the one-eyed suits (hearts,
// spades); front-facing (two eyes visible) for the two-eyed suits
// (diamonds, clubs) — matching the traditional playing-card convention,
// which happens to line up with lib/game/jacks.ts's wild/anti-wild split.
interface JackFaceProps {
  variant: "profile" | "front";
  className?: string;
}

export default function JackFace({ variant, className }: JackFaceProps) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* shoulders / collar */}
      <path
        d="M8 54 L17 39 L31 39 L40 54 Z"
        fill="currentColor"
        opacity="0.25"
      />
      {/* crown */}
      <path
        d="M11 15 L15 4 L20 11 L24 2 L28 11 L33 4 L37 15 Z"
        fill="currentColor"
      />
      <rect x="11" y="14" width="26" height="4" rx="1" fill="currentColor" />

      {variant === "front" ? (
        <>
          <ellipse
            cx="24"
            cy="31"
            rx="12"
            ry="14"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="19" cy="28" r="2.2" fill="currentColor" />
          <circle cx="29" cy="28" r="2.2" fill="currentColor" />
          <path
            d="M19 37 Q24 41 29 37"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M15 18 C10 18 8 24 9 30 C10 36 14 40 18 42 L23 42 C27 40 28 35 31 31 C34 28 33 24 29 22 C31 19 28 15 24 14 C20 12 16 14 15 18 Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="24" cy="27" r="2.2" fill="currentColor" />
          <path
            d="M19 37 Q24 41 27 39"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
