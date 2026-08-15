# Sequence — Online Multiplayer Card Game

## What this is
A web implementation of the board game Sequence, playable online with friends via a
shareable room link. See @docs/RULES.md for the complete, authoritative game rules —
always check the rules doc before implementing or changing any game-logic behavior
(turn flow, jacks, sequences, win conditions).

## Tech stack
- Frontend: Next.js (App Router) + TypeScript + React
- Styling: Tailwind CSS
- Multiplayer/backend: Supabase — Postgres for game state, Supabase Realtime for live
  sync between players
- Hosting: Vercel
- No user accounts/auth — players join a game via a shareable room code/link. Store a
  random per-player ID in the browser (e.g. localStorage) to identify "me" within a room.

## Game modes to support
- 2 individual players (7 cards each, need 2 sequences to win)
- 3 individual players (6 cards each, need 1 sequence to win)
- 2 teams of 2 players each (6 cards each, need 2 sequences to win) — turn order
  alternates between teams (TeamA-P1, TeamB-P1, TeamA-P2, TeamB-P2, ...), and a player
  should never see their teammate's hand.

## Conventions
- Strict TypeScript, no `any` unless justified with a comment
- Keep game-logic (turn resolution, sequence detection, jack effects) in pure,
  unit-testable functions, separate from UI components and Supabase calls
- `npm run dev` to test locally; `npm run build` should pass with no type errors before
  a milestone counts as done
- Commit after each verified milestone, not after every file edit

## Current status
Not yet started.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
