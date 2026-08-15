I'm building a web-based multiplayer implementation of the card game Sequence, using
Next.js (TypeScript, App Router), Tailwind, and Supabase (Postgres + Realtime) for
multiplayer sync, deployed to Vercel. No user accounts — players join via a shareable
room code/link.

The full authoritative rules are in docs/RULES.md — read it before writing any game
logic and treat it as ground truth over your own assumptions about how Sequence works.

Start in plan mode: propose a file/folder structure, the Supabase schema (games,
players, moves/board-state — your call on the exact shape), and a milestone-by-
milestone build order before writing any code. I want to review and approve the plan
first.

Once I approve, build in roughly this order, keeping each milestone independently
testable in the browser:
1. Static board + card-hand UI for one local player, no networking yet — I should be
   able to click a card, click a board square, and see a chip placed, in one tab.
2. Game-logic module as pure functions with a few unit tests: turn order, valid-move
   checking, sequence detection (including corner wildcards), jack effects, dead-card
   handling, and win-condition checking for all three modes.
3. Supabase integration: create/join a room via a short code, persist game state, sync
   moves in real time so two browser tabs see each other's moves live.
4. Full flow: lobby/room creation, waiting for players, mode selection, then the live
   game.
5. Polish: turn indicators, dead-card turn-in button, sequence highlight on the board,
   basic mobile-friendly layout.

Keep hands private throughout — a player only ever sees their own hand. Explain the
code as you go (what each key file does, any non-obvious syntax or library usage) —
I'm actively learning to code well, not just trying to get something working. Don't
start on deployment yet; we'll do that once the game works locally.