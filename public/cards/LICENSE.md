# Jack card artwork attribution

`jack-clubs.svg`, `jack-diamonds.svg`, `jack-hearts.svg`, and `jack-spades.svg`
are extracted from Byron Knoll's **Vector Playing Cards** deck:

- Author: Byron Knoll, 2011
- Source: https://github.com/notpeter/Vector-Playing-Cards
  (originally published on Google Code as `vector-playing-cards`; also
  mirrored on Wikimedia Commons)
- License: released into the public domain by the author. No attribution
  is legally required, though it's credited here anyway.

The face-card designs follow the traditional English/Bicycle pattern,
where the Jack of Hearts and Jack of Spades are drawn in full profile
(one eye visible) and the Jack of Clubs and Jack of Diamonds are drawn
facing forward (both eyes visible) — this is the real-world basis for
Sequence's "one-eyed jack" rule (see `lib/game/jacks.ts`), and it's why
this deck was chosen over the previous SVG-Cards one: that deck didn't
draw the one-eyed/two-eyed distinction consistently.

Each file was optimized with `svgo` (path precision reduced, redundant
markup stripped) but the artwork itself is unmodified.

See https://en.wikipedia.org/wiki/Jack_(playing_card)#Design for
background on the one-eyed jack convention.
