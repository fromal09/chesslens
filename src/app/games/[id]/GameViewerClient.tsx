'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { CLASSIFICATION_META, type MoveClassification } from '@/lib/analysis';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from 'recharts';

// SSR-safe chessboard import
const Chessboard = dynamic(() => import('react-chessboard').then(m => m.Chessboard), {
  ssr: false,
  loading: () => (
    <div className="aspect-square bg-surface-2 flex items-center justify-center">
      <span className="font-mono text-xs text-text-muted">Loading board…</span>
    </div>
  ),
});

interface GameMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  cpBefore: number | null;
  cpAfter: number | null;
  cpLoss: number | null;
  bestMove: string | null;
  classification: MoveClassification | null;
  evalSource: 'lichess' | 'stockfish' | 'none' | null;
}

interface Props {
  game: {
    id: string;
    pgn: string | null;
    white: string | null;
    black: string | null;
    result: string | null;
    colorPlayed: string | null;
    date: string | null;
    event: string | null;
    eco: string | null;
    openingName: string | null;
    whiteElo: number | null;
    blackElo: number | null;
    analysisStatus: string | null;
    totalPlies: number | null;
  };
  stats: {
    accuracy: number | null;
    blunders: number | null;
    mistakes: number | null;
    inaccuracies: number | null;
    goodMoves: number | null;
    excellentMoves: number | null;
    avgCpLoss: number | null;
    pieceActivity: Record<string, number> | null;
    squaresVisited: Record<string, number> | null;
  } | null;
  moves: GameMove[];
}

const PIECE_NAMES: Record<string, string> = {
  P: 'Pawns', N: 'Knights', B: 'Bishops', R: 'Rooks', Q: 'Queen', K: 'King'
};

export function GameViewerClient({ game, stats, moves }: Props) {
  const router = useRouter();
  const [currentPly, setCurrentPly] = useState(0);

  // Initial FEN or current position
  const chess = new Chess();
  const currentFen = currentPly === 0
    ? chess.fen()
    : moves[currentPly - 1]?.fenAfter ?? chess.fen();

  // Highlight squares for best move and played move
  const currentMove = currentPly > 0 ? moves[currentPly - 1] : null;
  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (currentMove) {
    const from = currentMove.uci.slice(0, 2);
    const to = currentMove.uci.slice(2, 4);
    const classification = currentMove.classification;
    const meta = classification ? CLASSIFICATION_META[classification] : null;
    const moveColor = meta ? `${meta.color}40` : 'rgba(201,160,80,0.3)';

    customSquareStyles[from] = { background: moveColor };
    customSquareStyles[to] = { background: moveColor };

    // Show best move if it differs
    if (currentMove.bestMove && currentMove.bestMove !== currentMove.uci) {
      const bFrom = currentMove.bestMove.slice(0, 2);
      const bTo = currentMove.bestMove.slice(2, 4);
      customSquareStyles[bFrom] = { background: 'rgba(52,211,153,0.2)' };
      customSquareStyles[bTo] = {
        background: 'rgba(52,211,153,0.4)',
        border: '2px solid rgba(52,211,153,0.6)',
      };
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setCurrentPly(p => Math.max(0, p - 1));
    if (e.key === 'ArrowRight') setCurrentPly(p => Math.min(moves.length, p + 1));
  }, [moves.length]);

  // Build move pairs for display
  const movePairs: Array<{ moveNum: number; white?: GameMove; black?: GameMove }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      moveNum: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  // Piece activity radar data
  const radarData = stats?.pieceActivity
    ? Object.entries(stats.pieceActivity).map(([piece, count]) => ({
        piece: PIECE_NAMES[piece] ?? piece,
        value: count,
        fullMark: Math.max(...Object.values(stats.pieceActivity!)) * 1.2,
      }))
    : [];

  // Accuracy color
  const accuracyColor =
    (stats?.accuracy ?? 0) >= 85 ? 'var(--excellent)' :
    (stats?.accuracy ?? 0) >= 70 ? 'var(--good)' :
    (stats?.accuracy ?? 0) >= 55 ? 'var(--inaccuracy)' : 'var(--blunder)';

  function getResultLabel() {
    const { result, colorPlayed } = game;
    if (!result || !colorPlayed || colorPlayed === 'unknown') return result ?? '?';
    if (result === '1-0') return colorPlayed === 'white' ? 'Win' : 'Loss';
    if (result === '0-1') return colorPlayed === 'black' ? 'Win' : 'Loss';
    return 'Draw';
  }

  const resultLabel = getResultLabel();

  return (
    <div
      className="min-h-screen chess-grid"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-accent/40 rotate-45 flex items-center justify-center">
            <span className="text-accent -rotate-45 text-xs font-mono">♟</span>
          </div>
          <span className="font-display text-lg font-semibold">ChessLens</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="font-mono text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          ← Dashboard
        </button>
      </nav>

      {/* Game header */}
      <div className="px-6 py-5 border-b border-border/30 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-xs text-text-muted mb-1">
                {game.date} · {game.event ?? 'Game'} · {game.eco ?? ''} {game.openingName ?? ''}
              </div>
              <h1 className="font-display text-2xl font-bold text-text-primary">
                {game.white ?? '?'}
                {game.whiteElo && <span className="text-text-muted font-normal text-base ml-2">({game.whiteElo})</span>}
                <span className="text-text-muted mx-3 font-normal">vs</span>
                {game.black ?? '?'}
                {game.blackElo && <span className="text-text-muted font-normal text-base ml-2">({game.blackElo})</span>}
              </h1>
            </div>
            <div className="text-right">
              <div className={`font-display text-2xl font-bold ${
                resultLabel === 'Win' ? 'text-excellent' :
                resultLabel === 'Loss' ? 'text-blunder' : 'text-text-muted'
              }`}>
                {resultLabel}
              </div>
              <div className="font-mono text-xs text-text-muted mt-1">{game.result}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px_260px] gap-6">

          {/* Board + controls */}
          <div className="space-y-4">
            <div className="border border-border overflow-hidden">
              <Chessboard
                position={currentFen}
                boardOrientation={game.colorPlayed === 'black' ? 'black' : 'white'}
                customSquareStyles={customSquareStyles}
                areArrowsAllowed={false}
                customBoardStyle={{ borderRadius: 0 }}
                customDarkSquareStyle={{ backgroundColor: '#b58863' }}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between bg-surface border border-border px-4 py-3">
              <button
                onClick={() => setCurrentPly(0)}
                className="font-mono text-sm text-text-muted hover:text-text-primary transition-colors px-1"
              >
                ⟨⟨
              </button>
              <button
                onClick={() => setCurrentPly(p => Math.max(0, p - 1))}
                className="font-mono text-sm text-text-muted hover:text-text-primary transition-colors px-2"
              >
                ⟨
              </button>
              <div className="font-mono text-xs text-text-muted">
                {currentPly === 0 ? 'Start' : `Move ${Math.ceil(currentPly / 2)} · ply ${currentPly}`}
              </div>
              <button
                onClick={() => setCurrentPly(p => Math.min(moves.length, p + 1))}
                className="font-mono text-sm text-text-muted hover:text-text-primary transition-colors px-2"
              >
                ⟩
              </button>
              <button
                onClick={() => setCurrentPly(moves.length)}
                className="font-mono text-sm text-text-muted hover:text-text-primary transition-colors px-1"
              >
                ⟩⟩
              </button>
            </div>

            <p className="font-mono text-xs text-text-muted text-center">
              Arrow keys to navigate · Click a move in the list
            </p>

            {/* Current move details */}
            {currentMove && (
              <div className="bg-surface border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-lg font-semibold text-text-primary">
                    {currentMove.san}
                  </span>
                  {currentMove.classification && (
                    <span
                      className={`badge-${currentMove.classification} border font-mono text-xs px-2 py-1`}
                    >
                      {CLASSIFICATION_META[currentMove.classification].emoji}{' '}
                      {CLASSIFICATION_META[currentMove.classification].label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono text-xs text-text-muted">
                  <div>
                    <div className="text-text-muted/60 mb-0.5">Before</div>
                    <div className="text-text-secondary">
                      {currentMove.cpBefore != null ? `${currentMove.cpBefore > 0 ? '+' : ''}${currentMove.cpBefore}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted/60 mb-0.5">After</div>
                    <div className="text-text-secondary">
                      {currentMove.cpAfter != null ? `${currentMove.cpAfter > 0 ? '+' : ''}${currentMove.cpAfter}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted/60 mb-0.5">Loss</div>
                    <div className={currentMove.cpLoss != null && currentMove.cpLoss > 50 ? 'text-blunder' : 'text-text-secondary'}>
                      {currentMove.cpLoss != null ? `-${currentMove.cpLoss}` : '—'}
                    </div>
                  </div>
                </div>
                {currentMove.bestMove && currentMove.bestMove !== currentMove.uci && (
                  <div className="mt-3 pt-3 border-t border-border font-mono text-xs">
                    <span className="text-text-muted">Best: </span>
                    <span className="text-excellent">{currentMove.bestMove}</span>
                    <span className="text-text-muted ml-2">(green squares)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Move list */}
          <div className="bg-surface border border-border overflow-hidden flex flex-col max-h-[600px] lg:max-h-none">
            <div className="px-4 py-3 border-b border-border font-mono text-xs text-text-muted uppercase tracking-wider bg-surface-2">
              Moves
            </div>
            <div className="overflow-y-auto flex-1">
              {movePairs.map(({ moveNum, white: wMove, black: bMove }) => (
                <div key={moveNum} className="flex items-stretch border-b border-border/30 last:border-0">
                  <div className="w-8 flex items-center justify-center font-mono text-xs text-text-muted bg-surface-2 border-r border-border/30 shrink-0">
                    {moveNum}
                  </div>

                  {/* White move */}
                  {wMove && (
                    <button
                      onClick={() => setCurrentPly(wMove.ply)}
                      className={`flex-1 flex items-center gap-1.5 px-2 py-2 text-left hover:bg-surface-2 transition-colors border-r border-border/30 ${
                        currentPly === wMove.ply ? 'bg-accent/10' : ''
                      }`}
                    >
                      {wMove.classification && (
                        <span
                          className="text-xs shrink-0"
                          style={{ color: CLASSIFICATION_META[wMove.classification].color }}
                        >
                          {CLASSIFICATION_META[wMove.classification].emoji}
                        </span>
                      )}
                      <span className="font-mono text-sm text-text-primary truncate">
                        {wMove.san}
                      </span>
                    </button>
                  )}

                  {/* Black move */}
                  {bMove && (
                    <button
                      onClick={() => setCurrentPly(bMove.ply)}
                      className={`flex-1 flex items-center gap-1.5 px-2 py-2 text-left hover:bg-surface-2 transition-colors ${
                        currentPly === bMove.ply ? 'bg-accent/10' : ''
                      }`}
                    >
                      {bMove.classification && (
                        <span
                          className="text-xs shrink-0"
                          style={{ color: CLASSIFICATION_META[bMove.classification].color }}
                        >
                          {CLASSIFICATION_META[bMove.classification].emoji}
                        </span>
                      )}
                      <span className="font-mono text-sm text-text-primary truncate">
                        {bMove.san}
                      </span>
                    </button>
                  )}
                  {!bMove && <div className="flex-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* Stats panel */}
          {stats && (
            <div className="space-y-4">
              {/* Accuracy */}
              <div className="bg-surface border border-border p-5">
                <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
                  Accuracy
                </div>
                <div className="font-display text-4xl font-bold" style={{ color: accuracyColor }}>
                  {stats.accuracy?.toFixed(1) ?? '—'}%
                </div>
                <div className="font-mono text-xs text-text-muted mt-1">
                  avg loss: {stats.avgCpLoss != null ? `${stats.avgCpLoss} cp` : '—'}
                </div>
              </div>

              {/* Move breakdown */}
              <div className="bg-surface border border-border p-5">
                <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4">
                  Move breakdown
                </div>
                <div className="space-y-2">
                  {(
                    [
                      ['Blunders',    stats.blunders,     'blunder'],
                      ['Mistakes',    stats.mistakes,     'mistake'],
                      ['Inaccuracies',stats.inaccuracies, 'inaccuracy'],
                      ['Good',        stats.goodMoves,    'good'],
                      ['Excellent',   stats.excellentMoves,'excellent'],
                    ] as Array<[string, number | null, MoveClassification]>
                  ).map(([label, count, cls]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="font-mono text-xs" style={{ color: CLASSIFICATION_META[cls].color }}>
                        {CLASSIFICATION_META[cls].emoji} {label}
                      </span>
                      <span className="font-mono text-xs font-medium text-text-primary">
                        {count ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Piece activity radar */}
              {radarData.length > 0 && (
                <div className="bg-surface border border-border p-5">
                  <div className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">
                    Piece activity
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="piece"
                        tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
                      />
                      <Radar
                        dataKey="value"
                        stroke="var(--accent)"
                        fill="var(--accent)"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--text-primary)',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
