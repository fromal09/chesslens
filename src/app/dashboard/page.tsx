import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, chess_username')
    .eq('id', user.id)
    .single();

  // Fetch recent games with stats
  const { data: recentGames } = await supabase
    .from('games')
    .select(`
      id, white, black, result, color_played, date, eco, opening_name,
      white_elo, black_elo, analysis_status, total_plies,
      game_stats ( accuracy, blunders, mistakes, inaccuracies )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20) as { data: Array<{
      id: string; white: string | null; black: string | null;
      result: string | null; color_played: string | null; date: string | null;
      eco: string | null; opening_name: string | null;
      white_elo: number | null; black_elo: number | null;
      analysis_status: string | null; total_plies: number | null;
      game_stats: Array<{ accuracy: number | null; blunders: number | null; mistakes: number | null; inaccuracies: number | null }>;
    }> | null };

  // Aggregate stats for header cards
  const { data: allStats } = await supabase
    .from('game_stats')
    .select('accuracy, blunders, mistakes, inaccuracies')
    .eq('user_id', user.id) as { data: Array<{ accuracy: number | null; blunders: number | null; mistakes: number | null; inaccuracies: number | null }> | null };

  const totals = (allStats ?? []).reduce(
    (acc, s) => ({
      games: acc.games + 1,
      blunders: acc.blunders + (s.blunders ?? 0),
      mistakes: acc.mistakes + (s.mistakes ?? 0),
      totalAccuracy: acc.totalAccuracy + (s.accuracy ?? 0),
      withAccuracy: acc.withAccuracy + (s.accuracy != null ? 1 : 0),
    }),
    { games: 0, blunders: 0, mistakes: 0, totalAccuracy: 0, withAccuracy: 0 }
  );

  const avgAccuracy = totals.withAccuracy > 0
    ? Math.round((totals.totalAccuracy / totals.withAccuracy) * 10) / 10
    : null;

  const games = (recentGames ?? []).map(g => ({
    id: g.id,
    white: g.white,
    black: g.black,
    result: g.result,
    colorPlayed: g.color_played,
    date: g.date,
    eco: g.eco,
    openingName: g.opening_name,
    whiteElo: g.white_elo,
    blackElo: g.black_elo,
    analysisStatus: g.analysis_status,
    totalPlies: g.total_plies,
    accuracy: (g.game_stats as any)?.[0]?.accuracy ?? null,
    blunders: (g.game_stats as any)?.[0]?.blunders ?? null,
    mistakes: (g.game_stats as any)?.[0]?.mistakes ?? null,
  }));

  return (
    <DashboardClient
      user={{ email: user.email ?? '', chessUsername: profile?.chess_username ?? '' }}
      games={games}
      totals={{ ...totals, avgAccuracy }}
    />
  );
}
