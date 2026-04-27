-- ============================================================
-- ChessLens Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- PROFILES: extends Supabase auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  chess_username text,          -- their Chess.com or Lichess handle for PGN matching
  created_at timestamptz default now()
);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- GAMES: raw PGN + extracted headers
create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  pgn text not null,
  white text,
  black text,
  result text,                  -- "1-0" | "0-1" | "1/2-1/2" | "*"
  color_played text,            -- "white" | "black" | "unknown"
  date date,
  event text,
  site text,
  time_control text,
  white_elo int,
  black_elo int,
  eco text,                     -- "C54" etc.
  opening_name text,
  termination text,
  total_plies int,
  analysis_status text default 'pending',  -- "pending" | "analyzing" | "complete" | "failed"
  created_at timestamptz default now()
);

-- GAME_STATS: one row per game, computed once on upload
create table public.game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games on delete cascade unique not null,
  user_id uuid references auth.users on delete cascade not null,
  accuracy numeric(5,2),        -- 0.00 - 100.00
  blunders int default 0,
  mistakes int default 0,
  inaccuracies int default 0,
  good_moves int default 0,
  excellent_moves int default 0,
  brilliant_moves int default 0,
  total_moves_analyzed int default 0,
  piece_activity jsonb,         -- { "P": 12, "N": 8, "B": 4, "R": 6, "Q": 3, "K": 2 }
  squares_visited jsonb,        -- { "e4": 3, "d4": 1, ... } heatmap
  avg_cp_loss numeric(6,2),
  created_at timestamptz default now()
);

-- MOVE_ANALYSIS: per-ply engine evaluation, stored once (never recomputed)
create table public.move_analysis (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  ply int not null,             -- 1-indexed half-moves
  san text not null,            -- "Nf3"
  uci text not null,            -- "g1f3"
  fen_before text not null,
  fen_after text not null,
  cp_before numeric(7,2),       -- centipawns from the player's perspective
  cp_after numeric(7,2),
  cp_loss numeric(7,2),         -- max(0, cp_before - cp_after)
  best_uci text,                -- engine's top choice
  classification text,          -- "brilliant"|"excellent"|"good"|"ok"|"inaccuracy"|"mistake"|"blunder"
  eval_source text,             -- "lichess"|"stockfish"|"none"
  unique(game_id, ply)
);

-- Indexes for common query patterns
create index idx_games_user_id on public.games(user_id);
create index idx_games_date on public.games(user_id, date desc);
create index idx_games_color on public.games(user_id, color_played);
create index idx_games_eco on public.games(user_id, eco);
create index idx_game_stats_user on public.game_stats(user_id);
create index idx_move_analysis_game on public.move_analysis(game_id, ply);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_stats enable row level security;
alter table public.move_analysis enable row level security;

-- Profiles: users see/edit only their own
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Games: users see/insert/delete only their own
create policy "games_select_own" on public.games
  for select using (auth.uid() = user_id);
create policy "games_insert_own" on public.games
  for insert with check (auth.uid() = user_id);
create policy "games_update_own" on public.games
  for update using (auth.uid() = user_id);
create policy "games_delete_own" on public.games
  for delete using (auth.uid() = user_id);

-- Game stats: same pattern
create policy "game_stats_select_own" on public.game_stats
  for select using (auth.uid() = user_id);
create policy "game_stats_insert_own" on public.game_stats
  for insert with check (auth.uid() = user_id);
create policy "game_stats_update_own" on public.game_stats
  for update using (auth.uid() = user_id);

-- Move analysis: same pattern
create policy "move_analysis_select_own" on public.move_analysis
  for select using (auth.uid() = user_id);
create policy "move_analysis_insert_own" on public.move_analysis
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Dashboard summary per user
create or replace view public.user_dashboard as
select
  g.user_id,
  count(g.id) as total_games,
  count(g.id) filter (where g.color_played = 'white' and g.result = '1-0') as white_wins,
  count(g.id) filter (where g.color_played = 'black' and g.result = '0-1') as black_wins,
  count(g.id) filter (where g.result = '1/2-1/2') as draws,
  round(avg(gs.accuracy), 1) as avg_accuracy,
  sum(gs.blunders) as total_blunders,
  sum(gs.mistakes) as total_mistakes,
  max(g.created_at) as last_game_at
from public.games g
left join public.game_stats gs on gs.game_id = g.id
group by g.user_id;
