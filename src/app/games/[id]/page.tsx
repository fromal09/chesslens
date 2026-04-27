import { redirect, notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { GameViewerClient } from './GameViewerClient';

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/');

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!game) notFound();

  const { data: stats } = await supabase
    .from('game_stats')
    .select('*')
    .eq('game_id', id)
    .single();

  const { data: moves } = await supabase
    .from('move_analysis')
    .select('*')
    .eq('game_id', id)
    .order('ply', { ascending: true });

  return (
    <GameViewerClient
      game={{
        id: game.id,
        pgn: game.pgn,
        white: game.white,
        black: game.black,
        result: game.result,
        colorPlayed: game.color_played,
        date: game.date,
        event: game.event,
        eco: game.eco,
        openingName: game.opening_name,
        whiteElo: game.white_elo,
        blackElo: game.black_elo,
        analysisStatus: game.analysis_status,
        totalPlies: game.total_plies,
      }}
      stats={stats ? {
        accuracy: stats.accuracy,
        blunders: stats.blunders,
        mistakes: stats.mistakes,
        inaccuracies: stats.inaccuracies,
        goodMoves: stats.good_moves,
        excellentMoves: stats.excellent_moves,
        avgCpLoss: stats.avg_cp_loss,
        pieceActivity: stats.piece_activity as Record<string, number> | null,
        squaresVisited: stats.squares_visited as Record<string, number> | null,
      } : null}
      moves={(moves ?? []).map(m => ({
        ply: m.ply,
        san: m.san,
        uci: m.uci,
        fenBefore: m.fen_before,
        fenAfter: m.fen_after,
        cpBefore: m.cp_before,
        cpAfter: m.cp_after,
        cpLoss: m.cp_loss,
        bestMove: m.best_uci,
        classification: m.classification as any,
        evalSource: m.eval_source as any,
      }))}
    />
  );
}
