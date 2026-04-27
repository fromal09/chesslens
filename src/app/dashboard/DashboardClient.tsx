'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

interface Game {
  id: string;
  white: string | null;
  black: string | null;
  result: string | null;
  colorPlayed: string | null;
  date: string | null;
  eco: string | null;
  openingName: string | null;
  whiteElo: number | null;
  blackElo: number | null;
  analysisStatus: string | null;
  totalPlies: number | null;
  accuracy: number | null;
  blunders: number | null;
  mistakes: number | null;
}

interface Props {
  user: { email: string; chessUsername: string };
  games: Game[];
  totals: {
    games: number;
    blunders: number;
    mistakes: number;
    avgAccuracy: number | null;
    withAccuracy: number;
  };
}

function getResultLabel(result: string | null, color: string | null): string {
  if (!result || !color || color === 'unknown') return result ?? '?';
  if (result === '1-0') return color === 'white' ? 'Win' : 'Loss';
  if (result === '0-1') return color === 'black' ? 'Win' : 'Loss';
  if (result === '1/2-1/2') return 'Draw';
  return result;
}

function getResultStyle(label: string): string {
  if (label === 'Win') return 'text-excellent';
  if (label === 'Loss') return 'text-blunder';
  if (label === 'Draw') return 'text-text-muted';
  return 'text-text-muted';
}

function AccuracyBadge({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) return <span className="text-text-muted font-mono text-xs">—</span>;
  const color =
    accuracy >= 85 ? 'text-excellent' :
    accuracy >= 70 ? 'text-good' :
    accuracy >= 55 ? 'text-inaccuracy' : 'text-blunder';
  return <span className={`font-mono text-xs font-medium ${color}`}>{accuracy.toFixed(1)}%</span>;
}

const STAT_CARDS = (totals: Props['totals']) => [
  { label: 'Games analyzed', value: totals.games, color: 'text-accent' },
  { label: 'Avg accuracy', value: totals.avgAccuracy != null ? `${totals.avgAccuracy}%` : '—', color: 'text-excellent' },
  { label: 'Total blunders', value: totals.blunders, color: 'text-blunder' },
  { label: 'Total mistakes', value: totals.mistakes, color: 'text-mistake' },
];

export function DashboardClient({ user, games, totals }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Build accuracy trend data from games (chronological)
  const trendData = [...games]
    .filter(g => g.accuracy != null && g.date)
    .reverse()
    .map((g, i) => ({
      name: g.date ?? `#${i + 1}`,
      accuracy: g.accuracy,
      label: g.date ? new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `#${i + 1}`,
    }));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen chess-grid">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-accent/40 rotate-45 flex items-center justify-center">
            <span className="text-accent -rotate-45 text-xs font-mono">♟</span>
          </div>
          <span className="font-display text-lg font-semibold">ChessLens</span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/games')}
            className="font-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Games
          </button>
          <button
            onClick={() => router.push('/upload')}
            className="px-4 py-2 bg-accent/10 border border-accent/30 text-accent text-xs font-mono hover:bg-accent/20 transition-all"
          >
            + Upload PGN
          </button>
          <button onClick={handleSignOut} className="font-mono text-xs text-text-muted hover:text-text-secondary transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 py-10 space-y-10">

        {/* Header */}
        <div className="animate-fade-up">
          <div className="font-mono text-accent/60 text-xs tracking-[0.25em] uppercase mb-2">
            Dashboard
          </div>
          <h1 className="font-display text-4xl font-bold text-text-primary">
            {user.chessUsername ? `${user.chessUsername}'s games` : 'Your games'}
          </h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/30 animate-fade-up animate-delay-100">
          {STAT_CARDS(totals).map((card, i) => (
            <div key={i} className="bg-surface p-6">
              <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">
                {card.label}
              </div>
              <div className={`font-display text-3xl font-bold ${card.color}`}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Accuracy trend */}
        {trendData.length >= 3 && (
          <div className="bg-surface border border-border p-6 animate-fade-up animate-delay-200">
            <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-6">
              Accuracy over time
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                  formatter={(val: number) => [`${val.toFixed(1)}%`, 'Accuracy']}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--accent)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent games */}
        <div className="animate-fade-up animate-delay-300">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xs text-text-muted uppercase tracking-wider">
              Recent games
            </div>
            {games.length > 0 && (
              <button
                onClick={() => router.push('/games')}
                className="font-mono text-xs text-accent hover:underline"
              >
                View all →
              </button>
            )}
          </div>

          {games.length === 0 ? (
            <div className="bg-surface border border-dashed border-border p-16 text-center">
              <div className="text-4xl text-accent/20 mb-4">♟</div>
              <p className="font-mono text-text-muted text-sm mb-6">No games yet</p>
              <button
                onClick={() => router.push('/upload')}
                className="px-6 py-3 bg-accent/10 border border-accent/30 text-accent text-sm font-mono hover:bg-accent/20 transition-all"
              >
                Upload your first PGN →
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_60px_60px] gap-4 px-5 py-3 border-b border-border bg-surface-2">
                {['Game', 'Date', 'Result', 'Accuracy', 'Blunders'].map(h => (
                  <div key={h} className="font-mono text-xs text-text-muted uppercase tracking-wider">
                    {h}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {games.map((game, i) => {
                const resultLabel = getResultLabel(game.result, game.colorPlayed);
                const opponent = game.colorPlayed === 'white' ? game.black : game.white;
                const myElo = game.colorPlayed === 'white' ? game.whiteElo : game.blackElo;
                const theirElo = game.colorPlayed === 'white' ? game.blackElo : game.whiteElo;

                return (
                  <button
                    key={game.id}
                    onClick={() => router.push(`/games/${game.id}`)}
                    className="w-full grid grid-cols-[1fr_80px_80px_60px_60px] gap-4 px-5 py-4 border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors text-left group"
                  >
                    {/* Game info */}
                    <div>
                      <div className="font-mono text-sm text-text-primary group-hover:text-accent transition-colors truncate">
                        {opponent ?? 'Unknown opponent'}
                        {theirElo && <span className="text-text-muted ml-2">({theirElo})</span>}
                      </div>
                      <div className="font-mono text-xs text-text-muted mt-0.5 truncate">
                        {game.openingName ?? game.eco ?? '—'}
                        {game.analysisStatus === 'analyzing' && (
                          <span className="ml-2 text-accent">● analyzing</span>
                        )}
                        {game.analysisStatus === 'pending' && (
                          <span className="ml-2 text-text-muted">● pending</span>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="font-mono text-xs text-text-muted self-center">
                      {game.date
                        ? new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'
                      }
                    </div>

                    {/* Result */}
                    <div className={`font-mono text-sm font-medium self-center ${getResultStyle(resultLabel)}`}>
                      {resultLabel}
                    </div>

                    {/* Accuracy */}
                    <div className="self-center">
                      <AccuracyBadge accuracy={game.accuracy} />
                    </div>

                    {/* Blunders */}
                    <div className="font-mono text-xs self-center">
                      {game.blunders != null ? (
                        <span className={game.blunders > 0 ? 'text-blunder' : 'text-text-muted'}>
                          {game.blunders}
                        </span>
                      ) : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
