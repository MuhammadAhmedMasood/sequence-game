# Sequence Game — Progress Log

Living summary of what's been built, why, and what's left. Update this file
after future milestones/fixes so a new session can resume with full context
without re-reading the whole git history.

## What this is

A web implementation of the board game Sequence, playable online with friends
via a shareable room link. No accounts — a random per-browser identity
(Supabase Anonymous Auth) identifies "me" within a room. See `docs/RULES.md`
for the authoritative game rules and `CLAUDE.md` for project conventions.

**Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS, Supabase
(Postgres + Realtime + Anonymous Auth) for multiplayer state, Vitest for the
game-logic unit tests. Deployed on Vercel, live at
**[sequence.dizzlerai.com](https://sequence.dizzlerai.com)** (custom domain
pointing at the `sequence-game-steel.vercel.app` deployment) — see
"Repository" below for how the deploy is wired up.

## Status: all 5 original milestones complete, plus a polish/fixes round

1. **Static board + hand UI** — done
2. **Pure game-logic module + unit tests** — done, 102 tests passing
3. **Supabase integration (live multiplayer)** — done
4. **Full flow** (landing → lobby → live game) — done
5. **Polish** (visuals, mobile, score tally, win/rematch) — done
6. **Sequence-detection edge-case audit** (`edge_cases.md`, all 11 cases) —
   done; found and fixed one real bug (see "Hard-won bugs" #7)
7. **Sequences-to-win lobby toggle** (1 or 2, default 2, all modes) — done,
   mirrors the existing hints toggle
8. **Hand-sync bug fix** — a player's own hand could permanently lose a
   card after playing it on an unreliable connection; done (see "Hard-won
   bugs" #8)
9. **Deck-exhaustion stalemate detection** — a game with nobody able to
   complete a winning sequence could grind to a permanent halt once the
   deck ran out; done (see "Hard-won bugs" #9). Required a live schema
   migration (`games.winner` widened from `text` to `text[]`), already
   applied to the hosted Supabase project.
10. **Authentic one-eyed/two-eyed jack artwork** — replaced all 4 jack
    images with Byron Knoll's public-domain "Vector Playing Cards" deck,
    which correctly draws hearts/spades in profile (one eye) and
    clubs/diamonds facing forward (both eyes), matching the game's own
    wild/anti-wild rule. The W/R badge overlay is gone — the art itself
    now reliably conveys it, and the jack legend shows real card
    thumbnails instead of colored circles. See `public/cards/LICENSE.md`.
11. **Deck composition + jack-caused dead-card audit** — verified, not a
    bug: exactly 8 jacks (4 one-eyed, 4 two-eyed) and exactly 2 of every
    other card (`lib/game/__tests__/deck.test.ts`), and the tricky case
    of a two-eyed jack "spending" one of a card's two board squares —
    later leaving any physical copy of that same card dead, even though
    neither copy was ever placed itself — was already correct by
    construction (`isDeadCard` only looks at current square occupancy,
    never at what put a chip there — confirmed against the official
    rules too). Added explicit regression tests for it (see "Hard-won
    bugs" #10 for the reasoning) rather than changing any logic.
12. **Real README** — replaced the create-next-app boilerplate with a
    proper overview: what the game is, full rules, screenshots, local
    setup, tech stack, and an annotated project structure + design-notes
    section for anyone reading the code. Also links the live deployment
    (`sequence.dizzlerai.com`) prominently at the top.
13. **2v2 team swap fix + completed-sequence chip styling** — reported
    live: once all 4 seats in a 2v2 lobby were filled (2/2 per team),
    there was no empty slot left to drag into, so switching sides was
    impossible. Fixed with a new `swap_player_team` RPC (see "Hard-won
    bugs" #11) that trades two players' teams atomically; dropping your
    name directly onto an opponent-team player now swaps with them
    (⇄ indicator on hover), on top of the existing move-into-an-empty-slot
    behavior. Also added: chips that are part of an already-completed
    sequence now render dulled (55% opacity) with a diagonal white
    strike, in both the live board and the local hot-seat board — purely
    visual, `sequencedSquares` threaded down from `game.sequences`/
    `activeGame.sequences` into `Board`/`BoardSquare`.
14. **Full UI redesign — felt & gold theme** (2026-08-19): replaced the
    ad-hoc indigo/purple/zinc Tailwind classes across every screen
    (landing, waiting room, board, hand, score/jack panels) with one
    centralized token system in `app/globals.css` — a card-table felt
    background (deliberately a dark surface in *both* light and dark mode,
    not flat white), a warm gold accent, jewel-tone chip colors, and
    CSS-variable-driven dark mode that auto-swaps without scattered
    `dark:` classes at every call site. The board is now a wood-toned
    framed container with playing-card-style cells; a completed sequence
    draws an actual connecting line across it (SVG, from the first to the
    last square in the run) instead of item 13's per-chip diagonal strike;
    placed chips are translucent (55% normally, 30% once part of a
    sequence) so the card's rank/suit stays legible underneath — both
    changes were direct user feedback after the first pass looked too
    opaque/cluttered. Legal-move shading uses a new teal token instead of
    gold, since gold was already the accent color everywhere else and
    competed with itself. New shared `JackLegend`/`JackHelpButton`
    components (deduped the old copy-pasted sidebar panel across two
    files) add a mobile bottom-sheet popover for the jack-rules
    explanation, previously invisible on phones. README screenshots
    regenerated to match. See "Hard-won bugs" #12–14 for three real bugs
    hit along the way (dark-mode contrast, an animation silently
    overriding chip opacity, and a board-sizing bug).

`npm run build` and `npm run test` are both green as of the last commit.
Pushed to GitHub — see "Repository" below.

## Repository

- **Remote**: `https://github.com/MuhammadAhmedMasood/sequence-game` (public,
  no description/topics set yet). Local `main` tracks `origin/main`, fully
  in sync as of the last commit.
- **Auth for pushing**: GitHub CLI (`gh`), installed via Homebrew at
  `/opt/homebrew/bin/gh` — not on this shell's cached `PATH`, so it needs the
  full path (or a fresh terminal) if `gh` comes back as "command not found"
  again. Logged in as `MuhammadAhmedMasood`; `gh auth setup-git` already
  configured git to use it, so plain `git push`/`git pull` work without
  further flags.
- An SSH key was also generated at `~/.ssh/id_ed25519` during setup before
  the `gh` path was confirmed working — unused, but harmless to leave in
  place if you'd rather switch the remote to SSH later
  (`git@github.com:MuhammadAhmedMasood/sequence-game.git`).
- **Live deployment**: Vercel, custom domain `sequence.dizzlerai.com` →
  `sequence-game-steel.vercel.app`. Auto-deploys from `main` (visible under
  the repo's "Deployments" — pushing to `main` is effectively shipping).
- **Commit attribution**: no `Co-Authored-By` trailer on any commit, by
  design — see `note.md` (gitignored, not in the repo) for the standing
  instruction. GitHub's contributors list should show only
  `MuhammadAhmedMasood`; verified via `git log --grep`/API right after the
  history rewrite that scrubbed the old trailers.
- **GitHub outage encountered 2026-08-17** (worth knowing if this recurs):
  a live, GitHub-wide incident made raw file content (README images) and
  the contributors sidebar throw errors/show stale data for a while —
  confirmed via githubstatus.com, not caused by anything in this repo.
  Resolves on its own; no local fix needed if you see this again and
  githubstatus.com shows an active incident.
- `.env.local` (Supabase URL + anon key) is correctly gitignored and has
  never been committed — confirmed via `git ls-files` and a check of the
  pushed tree on GitHub.

## Architecture

- `lib/game/` — pure, framework-free game logic (deck, deal, moves,
  sequences, jacks, win condition, turn order, board layout). No React or
  Supabase imports; unit-tested in `lib/game/__tests__/`. Shared verbatim
  between the local hot-seat demo and the live Supabase-backed game.
- `lib/supabase/` — `client.ts` (browser client, session in `localStorage` so
  identity survives closed tabs/crashes — tradeoff: two tabs in one browser
  share one identity), `queries.ts` (createRoom, joinRoom, setTeam,
  swapPlayerTeams, startGame, rematchGame), `types.ts` (DB row shapes).
- `hooks/useGame.ts` — the live-game data hook. Subscribes to Realtime
  Postgres Changes for `games`/`players`/`hands`, does optimistic local
  updates on every move, and layers several resilience mechanisms on top
  (see "Hard-won bugs" below): a turn-number staleness guard, a 4s
  games/players polling fallback, a separate 4s own-hand polling
  fallback, applying `play_card_and_draw`'s RPC response directly for the
  acting player's hand instead of trusting Realtime for it, and a
  reactive deck-exhaustion stalemate check that ends the game by
  sequence count when nobody can move any further.
- `app/room/[roomCode]/RoomClient.tsx` — the main orchestrator: lobby vs.
  live game vs. game-over, turn indicator, score sidebar, jack legend, board
  click handling.
- `components/lobby/WaitingRoom.tsx` — lobby UI, including the 2v2
  drag-and-drop team picker (Pointer Events, not HTML5 DnD, so it works on
  touch).
- `components/game/Scoreboard.tsx` — per-player/per-team sequence-progress
  panel (sidebar on desktop, compact pill bar on mobile).
- `components/game/JackLegend.tsx` / `JackHelpButton.tsx` — the two-eyed/
  one-eyed jack explanation, shared between the desktop sidebar panel and a
  mobile bottom-sheet popover (a "?" button) so both stay in sync instead
  of being copy-pasted per screen.
- `app/globals.css` — the design-token system: theme-dependent CSS
  variables (felt background, card face, ink, panel glass) on `:root`,
  overridden under `prefers-color-scheme: dark`, then re-exposed as
  Tailwind utilities via `@theme inline` — so `bg-card-face`/`text-ink`/etc.
  pick up the right light/dark value with no `dark:` variant needed at the
  call site. Theme-independent tokens (gold accent scale, chip colors,
  radii, shadows, the teal "legal move" color) live in a plain `@theme`
  block. One exception to the "theme-flipping var" pattern: `--felt-ink`,
  for text painted directly on the felt background — the felt itself is
  dark in *both* themes, so that text needs a light color that stays
  constant rather than flipping like `--ink` does (see Hard-won bugs
  below for what happens when that distinction gets missed).
- `supabase/schema.sql` — full schema: `games`, `players`, `hands` (secret),
  `decks` (secret, no client access at all), `moves`; RLS policies; four
  `SECURITY DEFINER` RPCs (`deal_game`, `play_card_and_draw`,
  `rematch_game`, `swap_player_team`). This file is the source of truth — always apply changes
  here to the live Supabase project too via the SQL Editor. `games.winner`
  is `text[]`, not a single value: `null` = not over, `[]` = draw, 1+
  colors = win (more than one is a tie for the lead at a stalemate — see
  `resolveStalemateWinners` in `lib/game/winCondition.ts`).

**Trust model** (deliberate, documented in the plan): RLS + RPCs hard-enforce
identity, turn order, and hand/deck secrecy. Move *content* legality (valid
square, real sequence, correct dead-card claim) is validated by the shared
`lib/game/` module on every client, not re-verified server-side. Acceptable
for a casual game among friends; avoids standing up an Edge Function layer.

## Game modes

- 2 players: 7 cards each.
- 3 players: 6 cards each.
- 2 teams of 2: 6 cards each, turn order alternates TeamA→TeamB→TeamA→TeamB
  (seat order is recomputed from each player's final team choice at start
  time, not join order).
- Sequences-to-win is no longer fixed per mode — it's a host-controlled
  lobby toggle (1 or 2, default 2, same UI pattern as the hints checkbox).
  3-player games used to be hardcoded to 1 sequence, which felt too short,
  so this is now the user's call for every mode.

## Features implemented

- Room creation/join via 5-character code; anonymous per-browser identity;
  reconnect support (closing/reopening the tab resumes the same seat and
  hand).
- Host-only lobby controls: pick mode, set shared hints-on/off, set
  sequences-to-win (1 or 2, default 2), start game.
- 2v2 team assignment via drag-and-drop (self-only — a player can drag their
  own name between Team A/B columns, not anyone else's; see "Decisions" below
  for why), including swapping places with an opponent once both columns are
  already full (drop your name directly onto them instead of an empty slot).
- Full board/hand UI with authentic jack card art (public-domain Vector
  Playing Cards deck) that correctly draws hearts/spades one-eyed and
  clubs/diamonds two-eyed, matching the wild/anti-wild rule — the jack
  legend shows real card thumbnails, no badge overlay needed.
- Hints mode: highlights every square the current player could legally play,
  excluding jacks (a two-eyed jack matches every open square, which would
  flood the board). Defaults on.
- Turn indicator shows the actual current player's name (or team + name in
  2v2), not a generic "waiting" message.
- "You: <color>" badge always visible so a player never has to guess their
  own chip color.
- Score/sequence-progress panel, always visible (sidebar desktop, compact bar
  mobile), highlighting the viewer's own row.
- Optimistic UI: chip placement and turn advancement update instantly on
  click, not after a network round trip.
- Win detection: the game ends the instant a player/team reaches
  sequencesToWin, live, for every connected client.
- Completed sequences are visually distinct on the board: an SVG line is
  drawn from the first to the last square of the run (in the owner's chip
  color), and its chips render more translucent (30% vs. the normal
  placed-chip's 55%) so the sequence reads as "spent" without needing a
  separate overlay layer.
- Placed chips are translucent, not solid — the board cell's rank/suit stays
  legible underneath a chip rather than being fully hidden.
- Mobile Jack-rules help: a "?" button opens a bottom-sheet popover with the
  same two-eyed/one-eyed explanation the desktop sidebar shows, since that
  sidebar is hidden on narrow viewports.
- Game-over screen: "Play again" (host-only, redeals immediately with the
  same lineup) and, in 2v2 only, "Shuffle teams & play again" (back to the
  lobby team picker). "Exit to home" available to everyone.
- Audible + visual "your turn" notification (Web Audio synthesized chime, no
  external asset).
- Rapid-double-click guard on board squares (ref-based synchronous check,
  since React state updates are batched/async).
- Full visual redesign — a shared "felt & gold" theme (card-table felt
  background, warm gold accent, jewel-tone chips) driven by centralized
  design tokens in `app/globals.css`, across landing page, lobby, and game
  view; verified usable at mobile viewport widths (390×844, then ~500px
  once the resize tool's floor was hit) via browser automation, and
  confirmed genuinely working on both a real phone and laptop after the
  LAN-access fix below.

## Hard-won bugs (read before touching `hooks/useGame.ts` again)

These were each non-obvious, verified by direct reproduction, not guessed:

1. **Mobile/LAN access silently broken**: `next dev` blocks every
   `/_next/*` client-script chunk request whose Origin isn't localhost by
   default. The page's HTML loaded fine over the LAN IP, but every client
   component chunk 403'd, so nothing ever hydrated — no visible error, just
   dead buttons. Fixed with `allowedDevOrigins: ["192.168.*.*"]` in
   `next.config.ts` (wildcarded, not the exact IP, since home routers
   commonly hand out a different address later). Dev-only; irrelevant once
   deployed.
2. **Chip placement "flashing back" / other player's turn never updating**:
   the reconnect-catchup refetch (fires on `visibilitychange`/`online`) could
   resolve *after* an in-flight optimistic move update and silently overwrite
   it with the pre-move snapshot. Fixed with a staleness guard
   (`applyIfNewer` in `useGame.ts`) that rejects any incoming `games` row
   whose `turn_number` is behind what's already showing — *unless* `status`
   also changed, which is always an intentional transition, never something a
   stale read invents. (The first version of this guard didn't have that
   `status` carve-out and consequently broke rematches — see next point.)
3. **Rematch appearing to silently do nothing**: the fix above, before the
   `status`-change carve-out was added, correctly rejected stale mid-game
   reads but *also* rejected the legitimate `turn_number` reset a rematch
   performs (0 is "behind" the finished game's turn_number), permanently
   stranding the client on the finished board until a manual reload.
4. **Win detection was simply missing**: `checkWinner` existed as a tested
   pure function but nothing ever called it in the live multiplayer path —
   `games.winner` stayed `null` forever regardless of the board. Not a
   regression, just never wired up until this was explicitly built.
5. **Landing page occasionally stuck on "Setting up the game…"**: the local
   hot-seat demo's game was created eagerly on every mount, and the "which
   screen to show" check for it ran *before* the check for whether to show
   the online panel at all — so the online panel's render was needlessly
   gated behind local-game setup finishing. Reordered so the online panel
   never depends on that state, and the local game is now created lazily
   (only when "Practice locally" is actually clicked).
6. **Missed Realtime events with no recovery**: a client whose Realtime
   channel subscription hadn't finished joining yet (e.g. right as the host
   clicks "Start game") can miss that event outright — Postgres Changes has
   no backlog/replay. Added a lightweight 4s poll (`games`+`players` only,
   visible tabs only, guarded by the same staleness check) as a bounded
   self-heal under Realtime, not a replacement for it.
7. **Extending a corner-based sequence by one chip was miscounted as a
   second sequence** (`lib/game/sequences.ts`, `findNewSequences`). The only
   guard against reusing chips was a per-square cap ("no square counts
   toward more than 2 sequences") — that alone doesn't stop a sliding
   5-window that overlaps a just-recorded sequence by 4 squares, since each
   of those 4 squares individually still has usage < 2. The real rule is
   pairwise: any two sequences may share at most 1 square, checked between
   the candidate and *each* already-recorded sequence independently, not
   just a per-square total. Fixed by adding that pairwise overlap check
   alongside the existing per-square cap (both are needed — see
   `edge_cases.md` and `lib/game/__tests__/edge-cases.test.ts` for the full
   11-case audit this came out of, cases 1-3 were the ones that actually
   failed before the fix).
8. **A player's own hand could permanently lose a card after playing it**
   (`hooks/useGame.ts`, `playMove`/`swapDeadCard`) — reported live: one
   player's hand stayed one card short after their turn, on a mobile
   connection. Root cause: after the optimistic "remove the played card"
   update, the code relied entirely on the `hands` Realtime subscription
   to deliver the replacement drawn card — but `play_card_and_draw`'s RPC
   response already *returns* the caller's fully updated hand (card
   removed + replacement drawn) directly, and the code was ignoring it.
   If that Realtime event was ever missed (exactly the same no-replay
   risk bug 6 above already documents for `games`/`players`, but there
   was no fallback at all for `hands`), the hand stayed short with
   nothing to correct it short of a manual reload. Fixed two ways: (a)
   both functions now apply the RPC's own returned hand directly, so the
   acting player's hand is correct immediately regardless of Realtime
   delivery; (b) added a bounded 4s poll for the player's own hand
   (visible tabs only, skipped while a move is mid-flight), mirroring the
   existing games/players poll, so even a client that never calls the RPC
   itself (e.g. the initial deal on game start) self-heals within a few
   seconds if its own `hands` Realtime event was dropped. Verified live:
   the underlying data was always correct in the DB — reproduced the
   "empty hand right after Start game" case, confirmed it was a delivery
   gap (not a data bug) by watching the same `hands` select the poll now
   runs fix it once the tab is genuinely visible.
9. **A game could grind to a permanent, unrecoverable halt near the end
   of the deck** — reported live in a 3-player game: nobody could
   complete another sequence, and eventually a player was left holding
   only dead cards (both squares of every card already covered) with the
   deck empty, so a dead-card swap couldn't draw a replacement either.
   RULES.md doesn't cover this case, and nothing in the app detected it
   — the game just sat frozen on that player's turn forever. Fixed with
   `hasLegalMove` (`lib/game/moves.ts`, true only if some card in hand
   can actually place/remove right now) and `resolveStalemateWinners`
   (`lib/game/winCondition.ts`, declares whoever has the most completed
   sequences the winner, a shared win on a tie for the lead, or a full
   draw if every player is tied — including 0-0-0). Wired in as a
   reactive check in `hooks/useGame.ts` (online) and directly in
   `playMove`/`handleDeadCardSwap` (local hot-seat in `app/page.tsx`).
   The online check only ever evaluates *the acting client's own hand*
   — never another player's — matching the existing trust model, and
   resolves by writing straight to `games` since RLS's "update on your
   turn" policy already permits exactly that player to do so. This
   required widening `games.winner` from a single color to an array (see
   the schema.sql bullet in "Architecture") to represent ties/draws, a
   live migration applied to the hosted Supabase project via the SQL
   Editor (verified via `information_schema.columns` before and after,
   and by spot-checking existing rows converted cleanly — no data loss).
   Verified with a 60-game full-simulation test (`lib/game/__tests__/
   stalemate.test.ts`, 20 seeded trials × all 3 modes) proving the game
   always reaches a resolved end state and never deadlocks, plus a live
   end-to-end check against the migrated production DB (SQL-set a room
   to `completed`/`winner: ["red"]`, confirmed the UI rendered "X wins!"
   correctly).
10. **Not a bug, but worth recording**: a two-eyed jack can "spend" one
    of a card's two board squares without ever using that card itself —
    e.g. a wild jack fills one of 5♠'s two squares, someone else's real
    5♠ fills the other, and now the *other physical copy* of 5♠ (from
    the double deck) is dead the moment anyone draws it, despite neither
    copy ever having touched the board together. This turns out to
    already be exactly correct: `isDeadCard` only ever looks at current
    square occupancy, never at what put a chip there, so it doesn't need
    to know or care that a jack was involved — confirmed this matches
    the official rule (dead card = "both spaces... covered by a marker
    chip", no jack exception) and added explicit regression tests
    (`lib/game/__tests__/deadCard.test.ts`) covering: a jack filling only
    one square (not yet dead), both squares filled entirely by jacks
    (dead, swap valid, normal placement rejected), and a one-eyed jack
    removing one of those chips reviving the card. Also added a test
    locking in the exact deck composition (`lib/game/__tests__/
    deck.test.ts`): 8 jacks (4 one-eyed, 4 two-eyed) and exactly 2 of
    every other card. No game logic changed — this was a verification
    pass, not a fix.
11. **2v2 team swap was impossible once the lobby was full**: `setTeam`
    (a plain RLS-gated `UPDATE ... WHERE id = <own player>`) only ever
    moves a player into an empty slot in the other team's column —
    `canDropOn` requires `teamCount(team) < 2`. That's fine while the
    lobby is still filling up, but the *normal* end state once all 4
    seats are taken is both columns at 2/2, so there is never an empty
    slot to move into again — switching sides silently stopped working
    exactly when players would actually want to use it (after everyone's
    joined). The fix isn't a bigger `canDropOn` — a genuine swap has to
    write *two* players' rows in one transaction, and the second row
    isn't the caller's own, so plain RLS can't allow it without loosening
    the policy to "any seated player can rewrite any other player's row."
    Added `swap_player_team`, a `SECURITY DEFINER` RPC that verifies the
    caller owns one side of the swap, both players share a game still in
    `lobby`, then flips both rows' `team`/`chip_color` together. Dropping
    your name directly onto an occupant of the other column now triggers
    this instead of the empty-slot `setTeam` path.
12. **Dark mode made several redesign elements invisible, because a
    theme-flipping token was reused for the wrong purpose** — two separate
    instances of the same underlying mistake, both found by manually
    overriding the CSS custom properties to simulate dark mode (there's no
    way to flip the OS setting from browser automation) and screenshotting:
    (a) header/tagline text used `text-card-face`, which is light cream in
    light mode (reads fine on the dark felt) but flips to near-black in
    dark mode since it's the *card surface* token, not text-on-felt — so
    it went invisible. Fixed by adding `--felt-ink`, a light color that
    deliberately does *not* flip between themes, since the felt background
    itself is dark in both. (b) Several gold-filled buttons/badges/pills
    (mode selector active state, "Your turn!" pill, host badges, primary
    CTAs) paired a solid gold background with `text-ink` — `--ink` also
    flips (dark in light mode, light in dark mode), so pairing it with a
    background that *doesn't* flip put light cream text on a light gold
    button in dark mode. Fixed by adding a second, non-flipping
    `--ink-fixed`/`--parchment` pair for anything painted directly on gold.
    General lesson: a theme-flipping token is only safe to pair with
    another element that flips *in sync* with it (same background); a
    fixed-color surface needs a fixed-color pairing.
13. **A CSS keyframe animation silently pinned chip opacity back to 1, no
    matter what `opacity-*` utility class was applied** (`app/globals.css`,
    the `chip-place` animation) — a real debugging detour: repeatedly
    lowering the opacity class on placed chips (80→55→30, per user
    feedback that the card underneath should stay visible) had zero
    visible effect, even after confirming via `curl`ing the compiled
    stylesheet that the CSS rule genuinely existed with the correct value.
    Root cause: `chip-place`'s keyframes animated `opacity` (0→1→1, part of
    the placement "settle" effect) alongside `transform`, and with
    `animation-fill-mode: both`, a CSS animation's effect on a property
    wins over any static declaration for that same property regardless of
    specificity — so the animation's own final `opacity: 1` silently
    overrode the utility class forever, the instant the 260ms animation
    finished. Fixed by making the keyframes transform-only (scale, no
    opacity) — the animation stops touching the property at all, so the
    static class applies normally. General lesson: never animate a CSS
    property that a separate utility class on the same element is also
    meant to control.
14. **The board rendered far smaller than intended because `h-full` was on
    the wrong element** — after splitting the single board container into
    a wood-toned outer frame + inner grid (for the redesign), the sizing
    classes (`h-full w-auto max-w-full aspect-square`) stayed on the
    *inner* grid, whose parent (the frame) had no defined height of its
    own. `height: 100%` against an auto-height parent computes to nothing,
    so the grid silently fell back to its own intrinsic content size
    instead of filling the available space — reported as "the board (and
    its cards) need to be bigger." Fixed by moving the sizing classes onto
    the outer frame and letting the inner grid just fill it
    (`h-full w-full`).

## Decisions worth knowing about

- **Drag-and-drop team picker is self-only, not "any player can move any
  player."** The wider version was scoped, but would have required loosening
  a `players` RLS policy so any seated player could rewrite any other
  player's row — the user was asked and chose the narrower, safer scope.
- **Trust model is intentionally not adversarial-hardened** (see
  "Architecture" above) — this is a casual game for friends, not a public
  competitive product. Don't over-engineer server-side validation beyond
  what's already there without checking whether it's actually warranted.
- **`localStorage` (not `sessionStorage`) for the auth session** — chosen so
  a closed/crashed tab can rejoin the same seat. Tradeoff: two tabs in the
  same browser are the same identity, so multiplayer testing from one browser
  needs either a second browser profile or direct SQL-inserted player rows
  (see testing note below).

## Testing notes for future sessions

- `npm run test` (Vitest) covers all of `lib/game/` — 102 tests, keep green.
- For manual multiplayer testing without two real browser identities: insert
  a second/third player row directly via the Supabase SQL Editor (bypasses
  RLS as the `postgres` role) rather than trying to fake a second session in
  the same browser.
- The Supabase SQL Editor's "Potential issue detected" confirmation dialog
  appears for any DML/DDL — click through it (usually "Run without RLS" or
  "Run query" depending on the warning).
- After any `supabase/schema.sql` change, apply the delta to the live
  project via the SQL Editor — the file being updated locally does **not**
  auto-apply.
- If `npm run dev` behaves inexplicably (clicks doing nothing, hydration
  mismatches) after a long session with many HMR reloads, a clean restart
  (`kill` the process, `npm run dev` again) has resolved it more than once —
  worth trying before assuming a real bug.
- Typing multi-line SQL directly into the Supabase SQL Editor (Monaco) via
  browser automation is unreliable: its autocomplete widget can eat the
  Enter keypress meant to insert a newline (accepting a suggestion instead),
  silently corrupting the query — and once, losing editor focus entirely
  mid-type caused the typed characters to be interpreted as dashboard
  keyboard shortcuts instead, navigating away from the SQL Editor. Safer:
  write the statement as a single line (SQL doesn't care about newlines
  outside string literals/`--` comments) and click directly into the editor
  body immediately before typing. `navigator.clipboard.writeText` from the
  page's own JS console also isn't reliable there ("Document is not
  focused") — don't rely on clipboard paste as the primary path.

- To visually verify a specific board state (e.g. a completed sequence,
  many scattered chips) without manually playing dozens of real turns to
  reach it: in the local hot-seat mode, grab the `Home` component's React
  fiber from a DOM node (`dom['__reactFiber$...']`, walk `.return` until
  `type.name === 'Home'`), find the `game` state hook by shape (its
  `memoizedState` has `.mode`/`.players`/`.board`, not by hardcoding a hook
  index — hook order shifts easily and doing it by index silently grabs
  the wrong hook), then call `hook.queue.dispatch({...game, board: {...},
  sequences: [...]})` directly. Much faster than trying to steer random
  card draws into a specific board layout, and was how the sequence-line
  and chip-transparency fixes in this session were actually confirmed
  working.

## Not yet done / explicitly out of scope so far

- Any account system (by design — room-code based, no auth beyond anonymous
  per-browser identity).
- Kicking/removing a player from a room, or cleaning up abandoned rooms.
- Spectator mode.
