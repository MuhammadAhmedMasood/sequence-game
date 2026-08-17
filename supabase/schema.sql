-- Sequence multiplayer schema.
--
-- Trust model (see CLAUDE.md / the approved plan):
--   - games, players, moves: public, world-readable — board state, turn
--     order, and played cards are public info in real Sequence too.
--   - hands, decks: secret. hands is readable only by its owner (RLS);
--     decks has no client-facing policies at all (default-deny).
--   - RLS enforces identity, turn order, and hand/deck secrecy. Move
--     *content* legality (is this square open, is this really a
--     sequence) is enforced by the shared TypeScript game-logic module
--     that every client runs — not re-verified here. This is a
--     deliberate scope call for a casual game between friends.
--   - The two SECURITY DEFINER RPCs below are the only place secret
--     mutations happen; everything else is direct table reads/writes
--     gated by RLS policies.
--
-- Apply this whole file via the Supabase SQL Editor.

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  mode text not null check (mode in ('two-player', 'three-player', 'two-team')),
  hand_size int not null,
  sequences_to_win int not null,
  status text not null default 'lobby' check (status in ('lobby', 'in_progress', 'completed')),
  board_chips jsonb not null default '{}'::jsonb,
  sequences jsonb not null default '[]'::jsonb,
  sequence_usage jsonb not null default '{}'::jsonb,
  discard_top jsonb,
  deck_count int not null default 0,
  current_seat_index int not null default 0,
  turn_number int not null default 0,
  -- null: not over. Empty array: over as a draw. Non-empty: winning
  -- color(s) — more than one means a tie for the lead at a stalemate
  -- (deck exhausted with nobody able to move; see resolveStalemateWinners
  -- in lib/game/winCondition.ts). A plain reach-sequencesToWin win is
  -- always a single-element array.
  winner text[],
  -- A host-set, whole-game setting (not a per-client preference): the
  -- host chooses it once before starting, and it applies to every player.
  hints_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotent on an already-existing table (re-running this file against
-- a project that predates this column just adds it).
alter table games add column if not exists hints_enabled boolean not null default false;

-- Widens winner from a single color to an array (see the column comment
-- above). Only touches a project that predates the change — a fresh
-- `create table` already declares the array type, so this no-ops there.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'games' and column_name = 'winner' and data_type = 'text'
  ) then
    alter table games
      alter column winner type text[]
      using case when winner is null then null else array[winner] end;
  end if;
end $$;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text not null,
  seat_index int not null,
  team text check (team in ('A', 'B')),
  chip_color text not null check (chip_color in ('red', 'blue', 'green')),
  joined_at timestamptz not null default now(),
  unique (game_id, seat_index),
  unique (game_id, auth_user_id)
);

create table if not exists hands (
  player_id uuid primary key references players(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  auth_user_id uuid not null,
  cards jsonb not null default '[]'::jsonb
);

create table if not exists decks (
  game_id uuid primary key references games(id) on delete cascade,
  cards jsonb not null default '[]'::jsonb
);

create table if not exists moves (
  id bigint generated always as identity primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  move_number int not null,
  card jsonb not null,
  action jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists players_game_id_idx on players(game_id);
create index if not exists hands_game_id_idx on hands(game_id);
create index if not exists moves_game_id_idx on moves(game_id);

alter table games   enable row level security;
alter table players enable row level security;
alter table moves   enable row level security;
alter table hands   enable row level security;
alter table decks   enable row level security;

drop policy if exists "read games" on games;
create policy "read games" on games for select using (true);

drop policy if exists "read players" on players;
create policy "read players" on players for select using (true);

drop policy if exists "read moves" on moves;
create policy "read moves" on moves for select using (true);

drop policy if exists "join as self" on players;
create policy "join as self" on players for insert
  with check (auth_user_id = auth.uid());

-- Lets a player drag-and-drop their own name between team columns in the
-- 2v2 lobby, only before the game starts — seat_index/turn order gets
-- finalized by deal_game once it does, so team changes afterward would
-- silently desync from it. Deliberately self-only (not "any seated player
-- can move any player"): that would require every other row to be
-- writable by everyone in the lobby, a much bigger blast radius for one
-- UI convenience.
drop policy if exists "update own player before start" on players;
create policy "update own player before start" on players for update
  using (
    auth_user_id = auth.uid()
    and exists (select 1 from games g where g.id = players.game_id and g.status = 'lobby')
  )
  with check (auth_user_id = auth.uid());

-- Only the seated player whose turn it currently is may update the game
-- row — this is the RLS-enforced turn-order check. The explicit
-- `with check (true)` matters: without it, Postgres reuses the USING
-- expression as the WITH CHECK too, which would re-evaluate
-- `games.current_seat_index` against the *new* row — but a turn-ending
-- move deliberately changes current_seat_index to the *other* player,
-- so that would reject every legitimate move. USING (checked against the
-- pre-update row) is the actual turn-order gate; WITH CHECK just needs
-- to allow the resulting row through.
drop policy if exists "update on your turn" on games;
create policy "update on your turn" on games for update
  using (exists (
    select 1 from players p
    where p.game_id = games.id
      and p.auth_user_id = auth.uid()
      and p.seat_index = games.current_seat_index
  ))
  with check (true);

-- Anyone may create a game row (room creation happens before any player
-- is seated, so there's no "current player" to check against yet).
drop policy if exists "create game" on games;
create policy "create game" on games for insert
  with check (true);

-- Ownership only (not a turn-order re-check): moves is a log for live UX
-- (toasts/animations), not the source of truth, and turn order is already
-- enforced by the `games` update policy above, which the client writes to
-- in the same flow. Checking games.current_seat_index here too would hit
-- the same stale-vs-fresh-row problem as above, since by the time this
-- insert runs the games row has typically already advanced.
drop policy if exists "log your move" on moves;
create policy "log your move" on moves for insert
  with check (exists (
    select 1 from players p
    where p.id = moves.player_id
      and p.auth_user_id = auth.uid()
  ));

-- hands: read-only, own row only. No insert/update/delete policy at all —
-- every mutation goes through the SECURITY DEFINER RPCs below.
drop policy if exists "read own hand" on hands;
create policy "read own hand" on hands for select
  using (auth_user_id = auth.uid());

-- decks: no policies at all -> default-deny for every client, always.

-- Deals a fresh 104-card shuffled deck to a lobby game: builds the deck,
-- shuffles it, deals hand_size cards to each seated player (in seat
-- order), stores the remainder in decks, and flips the game to
-- in_progress. Callable only by a player already seated in that game.
create or replace function deal_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_hand_size int;
  v_player record;
  v_deck jsonb[];
  v_ranks text[] := array['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  v_suits text[] := array['hearts','diamonds','clubs','spades'];
  v_rank text;
  v_suit text;
  v_copy int;
  v_cursor int := 1;
  v_deck_len int;
begin
  if not exists (
    select 1 from players
    where game_id = p_game_id and auth_user_id = auth.uid()
  ) then
    raise exception 'not a player in this game';
  end if;

  select mode, hand_size into v_mode, v_hand_size from games where id = p_game_id;
  if v_hand_size is null then
    raise exception 'game not found';
  end if;

  -- Team mode: seats have to alternate TeamA/TeamB for turn order, but the
  -- lobby's team picker lets players freely switch teams right up until
  -- start, so seat_index (assigned at join time) can no longer be trusted
  -- to reflect that alternation. Recompute it here from each player's
  -- final team choice, in join order within each team.
  if v_mode = 'two-team' then
    if (select count(*) from players where game_id = p_game_id and team = 'A') <> 2
      or (select count(*) from players where game_id = p_game_id and team = 'B') <> 2
    then
      raise exception 'each team needs exactly 2 players';
    end if;

    -- Two-phase update: reassigning seat_index directly risks transiently
    -- colliding with another row's current value under the
    -- (game_id, seat_index) unique constraint. Landing everyone on a
    -- guaranteed-distinct negative value first, then flipping to the
    -- final positive value, avoids that regardless of ordering.
    with team_a as (
      select id, row_number() over (order by joined_at) - 1 as rn
      from players where game_id = p_game_id and team = 'A'
    ), team_b as (
      select id, row_number() over (order by joined_at) - 1 as rn
      from players where game_id = p_game_id and team = 'B'
    ), combined as (
      select id, (rn * 2)::int as new_seat from team_a
      union all
      select id, (rn * 2 + 1)::int as new_seat from team_b
    )
    update players p set seat_index = -1 - c.new_seat
    from combined c where c.id = p.id;

    update players set seat_index = -1 - seat_index
    where game_id = p_game_id and seat_index < 0;
  end if;

  v_deck := array[]::jsonb[];
  for v_copy in 0..1 loop
    foreach v_suit in array v_suits loop
      foreach v_rank in array v_ranks loop
        v_deck := v_deck || jsonb_build_object(
          'rank', v_rank,
          'suit', v_suit,
          'instanceId', v_rank || '-' || v_suit || '-' || v_copy
        );
      end loop;
    end loop;
  end loop;

  select array_agg(card order by random()) into v_deck from unnest(v_deck) as card;
  v_deck_len := array_length(v_deck, 1);

  for v_player in select id, auth_user_id from players where game_id = p_game_id order by seat_index loop
    insert into hands (player_id, game_id, auth_user_id, cards)
    values (
      v_player.id,
      p_game_id,
      v_player.auth_user_id,
      to_jsonb(v_deck[v_cursor : v_cursor + v_hand_size - 1])
    )
    on conflict (player_id) do update set cards = excluded.cards;
    v_cursor := v_cursor + v_hand_size;
  end loop;

  insert into decks (game_id, cards)
  values (p_game_id, to_jsonb(v_deck[v_cursor : v_deck_len]))
  on conflict (game_id) do update set cards = excluded.cards;

  update games
  set status = 'in_progress',
      deck_count = v_deck_len - (v_cursor - 1),
      current_seat_index = 0,
      turn_number = 0
  where id = p_game_id;
end;
$$;

-- Removes the named card instance from the caller's hand and draws one
-- replacement from the shared deck, returning the caller's updated hand.
-- Used both for a normal turn-ending play and for a dead-card swap (the
-- caller decides separately whether to also advance games.current_seat_index
-- via a direct UPDATE — this RPC only ever touches hands/decks).
create or replace function play_card_and_draw(
  p_game_id uuid,
  p_rank text,
  p_suit text,
  p_instance_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_hand jsonb;
  v_card jsonb;
  v_new_hand jsonb;
  v_deck jsonb;
  v_drawn jsonb;
  v_rest jsonb;
begin
  select id into v_player_id from players
  where game_id = p_game_id and auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'not a player in this game';
  end if;

  if not exists (
    select 1 from players p
    join games g on g.id = p.game_id
    where p.id = v_player_id and p.seat_index = g.current_seat_index
  ) then
    raise exception 'not your turn';
  end if;

  select cards into v_hand from hands where player_id = v_player_id;

  select elem into v_card
  from jsonb_array_elements(coalesce(v_hand, '[]'::jsonb)) elem
  where elem->>'instanceId' = p_instance_id
    and elem->>'rank' = p_rank
    and elem->>'suit' = p_suit
  limit 1;

  if v_card is null then
    raise exception 'card not in hand';
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_new_hand
  from jsonb_array_elements(v_hand) elem
  where elem->>'instanceId' <> p_instance_id;

  select cards into v_deck from decks where game_id = p_game_id;

  if v_deck is not null and jsonb_array_length(v_deck) > 0 then
    v_drawn := v_deck->0;
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_rest
    from jsonb_array_elements(v_deck) with ordinality as t(elem, idx)
    where idx > 1;
    v_new_hand := v_new_hand || jsonb_build_array(v_drawn);
  else
    v_rest := '[]'::jsonb;
  end if;

  update hands set cards = v_new_hand where player_id = v_player_id;
  update decks set cards = v_rest where game_id = p_game_id;
  update games set deck_count = jsonb_array_length(v_rest) where id = p_game_id;

  return v_new_hand;
end;
$$;

-- Resets a finished game back to a fresh round: clears the board,
-- sequences, winner, hands, and deck. Host-only (mirrors "only the host
-- starts a game") and only once the previous round has actually ended —
-- a mid-game reset would strand every other client's board state with
-- no way to recover it. p_reset_teams sends players back to the lobby's
-- team picker (2v2 "shuffle teams"); otherwise this redeals immediately
-- via deal_game so the same lineup goes straight back into a new round
-- without a lobby detour.
create or replace function rematch_game(p_game_id uuid, p_reset_teams boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from players
    where game_id = p_game_id and auth_user_id = auth.uid() and seat_index = 0
  ) then
    raise exception 'only the host can start a rematch';
  end if;

  if not exists (
    select 1 from games where id = p_game_id and status = 'completed'
  ) then
    raise exception 'game has not finished yet';
  end if;

  delete from hands where game_id = p_game_id;
  delete from decks where game_id = p_game_id;

  update games
  set status = 'lobby',
      board_chips = '{}'::jsonb,
      sequences = '[]'::jsonb,
      sequence_usage = '{}'::jsonb,
      discard_top = null,
      winner = null,
      turn_number = 0,
      current_seat_index = 0,
      deck_count = 0
  where id = p_game_id;

  if not p_reset_teams then
    perform deal_game(p_game_id);
  end if;
end;
$$;

-- Swaps two players' teams (and derived chip colors) atomically. Needed
-- because once both team columns hold 2/2, there's no empty slot left for
-- "update own player before start" to move a player into — the only way
-- to change sides at that point is trading places with someone on the
-- other team, which means writing a row that isn't the caller's own, so
-- it can't be done as a plain RLS-gated UPDATE like setTeam's move-into-an-
-- empty-slot case. Callable only by one of the two players being swapped,
-- and only while the game is still in the lobby.
create or replace function swap_player_team(p_player_id uuid, p_other_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_my_team text;
  v_other_game_id uuid;
  v_other_team text;
begin
  select game_id, team into v_game_id, v_my_team
  from players
  where id = p_player_id and auth_user_id = auth.uid();

  if v_game_id is null then
    raise exception 'not your player';
  end if;

  select game_id, team into v_other_game_id, v_other_team
  from players where id = p_other_player_id;

  if v_other_game_id is null or v_other_game_id <> v_game_id then
    raise exception 'other player not in this game';
  end if;

  if not exists (select 1 from games where id = v_game_id and status = 'lobby') then
    raise exception 'game already started';
  end if;

  update players
  set team = v_other_team,
      chip_color = case v_other_team when 'A' then 'red' when 'B' then 'blue' else chip_color end
  where id = p_player_id;

  update players
  set team = v_my_team,
      chip_color = case v_my_team when 'A' then 'red' when 'B' then 'blue' else chip_color end
  where id = p_other_player_id;
end;
$$;

-- Enable Realtime broadcasts (Postgres Changes) for these tables. Easy to
-- forget: RLS alone doesn't make row changes stream to clients — the
-- table also has to be added to the supabase_realtime publication.
-- Wrapped in existence checks so this file can be re-run safely.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'hands'
  ) then
    alter publication supabase_realtime add table hands;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'moves'
  ) then
    alter publication supabase_realtime add table moves;
  end if;
end $$;
