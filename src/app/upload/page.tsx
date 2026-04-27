'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  parseAllGames,
  detectColorPlayed,
  extractPieceActivity,
  extractSquaresVisited,
  classifyMove,
  computeAccuracy,
  type AnalyzedMove,
  type ParsedGame,
} from '@/lib/analysis';

type UploadPhase =
  | 'idle'
  | 'parsing'
  | 'uploading'
  | 'analyzing'
  | 'complete'
  | 'error';

interface GameProgress {
  gameId: string;
  title: string;
  current: number;
  total: number;
  phase: 'queued' | 'analyzing' | 'saving' | 'done' | 'error';
}

export default function UploadPage() {
  const [pgn, setPgn] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState('');
  const [parsedCount, setParsedCount] = useState(0);
  const [gameProgress, setGameProgress] = useState<GameProgress[]>([]);
  const [chessUsername, setChessUsername] = useState('');
  const [usernameLoaded, setUsernameLoaded] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Load chess username from profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('chess_username')
          .eq('id', user.id)
          .single();
        if (data?.chess_username) {
          setChessUsername(data.chess_username);
        }
      }
      setUsernameLoaded(true);
    });
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPgn(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.pgn')) return;
    const reader = new FileReader();
    reader.onload = ev => setPgn(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }, []);

  async function analyzeGameWithWorker(
    gameId: string,
    parsedGame: ParsedGame
  ): Promise<AnalyzedMove[]> {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker('/stockfish.worker.js');
      }

      const worker = workerRef.current;

      const positions = parsedGame.moves.map(m => ({
        ply: m.ply,
        san: m.san,
        uci: m.uci,
        fenBefore: m.fenBefore,
        fenAfter: m.fenAfter,
      }));

      worker.onmessage = (e) => {
        const { type, results, current, total } = e.data;

        if (type === 'progress') {
          setGameProgress(prev => prev.map(g =>
            g.gameId === gameId ? { ...g, current, total } : g
          ));
        }

        if (type === 'complete') {
          const analyzed: AnalyzedMove[] = results.map((r: any) => ({
            ply: r.ply,
            san: r.san,
            uci: r.uci,
            fenBefore: r.fenBefore,
            fenAfter: r.fenAfter,
            cpBefore: r.cpBefore,
            cpAfter: r.cpAfter,
            cpLoss: r.cpLoss,
            bestMove: r.bestMove,
            classification: classifyMove(r.cpLoss),
            evalSource: r.source,
          }));
          resolve(analyzed);
        }

        if (type === 'error') {
          reject(new Error(e.data.message));
        }
      };

      worker.onerror = (err) => reject(err);
      worker.postMessage({ type: 'analyze_game', positions, gameId });
    });
  }

  async function handleSubmit() {
    if (!pgn.trim()) return;
    setPhase('parsing');
    setError('');

    // Parse PGN
    let games: ParsedGame[];
    try {
      games = parseAllGames(pgn);
    } catch (err) {
      setError('Could not parse PGN. Please check the format and try again.');
      setPhase('error');
      return;
    }

    if (games.length === 0) {
      setError('No valid games found in the PGN.');
      setPhase('error');
      return;
    }

    setParsedCount(games.length);
    setPhase('uploading');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    // Save chess username to profile if provided
    if (chessUsername) {
      await supabase.from('profiles').update({ chess_username: chessUsername }).eq('id', user.id);
    }

    // Insert game rows
    const gameInserts = games.map(g => {
      const color = detectColorPlayed(g.headers, chessUsername);
      const dateStr = g.headers['Date']?.replace(/\?/g, '01').replace(/\./g, '-');
      const validDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null;

      return {
        user_id: user.id,
        pgn: games.length === 1 ? pgn : '', // store full pgn for single uploads
        white: g.headers['White'] ?? null,
        black: g.headers['Black'] ?? null,
        result: g.headers['Result'] ?? null,
        color_played: color,
        date: validDate,
        event: g.headers['Event'] ?? null,
        site: g.headers['Site'] ?? null,
        time_control: g.headers['TimeControl'] ?? null,
        white_elo: g.headers['WhiteElo'] ? parseInt(g.headers['WhiteElo']) : null,
        black_elo: g.headers['BlackElo'] ? parseInt(g.headers['BlackElo']) : null,
        eco: g.headers['ECO'] ?? null,
        opening_name: g.headers['Opening'] ?? null,
        termination: g.headers['Termination'] ?? null,
        total_plies: g.moves.length,
        analysis_status: 'pending',
      };
    });

    const { data: insertedGames, error: insertError } = await supabase
      .from('games')
      .insert(gameInserts)
      .select('id');

    if (insertError || !insertedGames) {
      setError('Failed to save games: ' + (insertError?.message ?? 'unknown error'));
      setPhase('error');
      return;
    }

    // Initialize progress tracking
    setGameProgress(insertedGames.map((g, i) => ({
      gameId: g.id,
      title: games[i].headers['White'] && games[i].headers['Black']
        ? `${games[i].headers['White']} vs ${games[i].headers['Black']}`
        : `Game ${i + 1}`,
      current: 0,
      total: games[i].moves.length,
      phase: 'queued',
    })));

    setPhase('analyzing');

    // Analyze each game sequentially
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      const gameId = insertedGames[i].id;

      setGameProgress(prev => prev.map(g =>
        g.gameId === gameId ? { ...g, phase: 'analyzing' } : g
      ));

      // Update status to analyzing
      await supabase.from('games').update({ analysis_status: 'analyzing' }).eq('id', gameId);

      try {
        const analyzed = await analyzeGameWithWorker(gameId, game);
        const color = detectColorPlayed(game.headers, chessUsername);

        // Insert move analysis rows in batches
        const moveRows = analyzed.map(m => ({
          game_id: gameId,
          user_id: user.id,
          ply: m.ply,
          san: m.san,
          uci: m.uci,
          fen_before: m.fenBefore,
          fen_after: m.fenAfter,
          cp_before: m.cpBefore,
          cp_after: m.cpAfter,
          cp_loss: m.cpLoss,
          best_uci: m.bestMove,
          classification: m.classification,
          eval_source: m.evalSource,
        }));

        // Insert in chunks of 100
        for (let j = 0; j < moveRows.length; j += 100) {
          await supabase.from('move_analysis').insert(moveRows.slice(j, j + 100));
        }

        setGameProgress(prev => prev.map(g =>
          g.gameId === gameId ? { ...g, phase: 'saving' } : g
        ));

        // Compute aggregates
        const playerMoves = analyzed.filter(m =>
          color === 'unknown' || (color === 'white' ? m.ply % 2 === 1 : m.ply % 2 === 0)
        );
        const accuracy = computeAccuracy(playerMoves);
        const pieceActivity = extractPieceActivity(game.moves, color === 'unknown' ? 'white' : color);
        const squaresVisited = extractSquaresVisited(game.moves, color === 'unknown' ? 'white' : color);

        const counts = analyzed.reduce((acc, m) => {
          acc[m.classification] = (acc[m.classification] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const cpLosses = playerMoves.map(m => m.cpLoss ?? 0);
        const avgCpLoss = cpLosses.length
          ? cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length
          : 0;

        await supabase.from('game_stats').insert({
          game_id: gameId,
          user_id: user.id,
          accuracy: Math.round(accuracy * 10) / 10,
          blunders: counts.blunder ?? 0,
          mistakes: counts.mistake ?? 0,
          inaccuracies: counts.inaccuracy ?? 0,
          good_moves: counts.good ?? 0,
          excellent_moves: counts.excellent ?? 0,
          brilliant_moves: counts.brilliant ?? 0,
          total_moves_analyzed: playerMoves.filter(m => m.evalSource !== 'none').length,
          avg_cp_loss: Math.round(avgCpLoss * 10) / 10,
          piece_activity: pieceActivity,
          squares_visited: squaresVisited,
        });

        await supabase.from('games').update({ analysis_status: 'complete' }).eq('id', gameId);

        setGameProgress(prev => prev.map(g =>
          g.gameId === gameId ? { ...g, phase: 'done' } : g
        ));

      } catch (err) {
        console.error('Analysis failed for game', gameId, err);
        await supabase.from('games').update({ analysis_status: 'failed' }).eq('id', gameId);
        setGameProgress(prev => prev.map(g =>
          g.gameId === gameId ? { ...g, phase: 'error' } : g
        ));
      }
    }

    setPhase('complete');
  }

  const isDragging = useRef(false);

  return (
    <div className="min-h-screen chess-grid">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-3 group">
          <div className="w-7 h-7 border border-accent/40 rotate-45 flex items-center justify-center">
            <span className="text-accent -rotate-45 text-xs font-mono">♟</span>
          </div>
          <span className="font-display text-lg font-semibold">ChessLens</span>
        </button>
        <button onClick={() => router.push('/dashboard')} className="font-mono text-xs text-text-muted hover:text-text-secondary transition-colors">
          ← Dashboard
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="animate-fade-up">
          <div className="font-mono text-accent/70 text-xs tracking-[0.25em] uppercase mb-3">
            Upload
          </div>
          <h1 className="font-display text-4xl font-bold text-text-primary mb-2">
            Add your games
          </h1>
          <p className="text-text-secondary text-base mb-10" style={{ fontFamily: 'var(--font-body)' }}>
            Paste PGN text or upload a .pgn file. Multi-game files are supported — all games analyzed in one go.
          </p>

          {phase === 'idle' || phase === 'error' ? (
            <div className="space-y-6">
              {/* Username */}
              <div>
                <label className="block font-mono text-xs text-text-muted mb-2 uppercase tracking-wider">
                  Your chess username{' '}
                  <span className="text-text-muted/50">(for color detection)</span>
                </label>
                <input
                  type="text"
                  value={chessUsername}
                  onChange={e => setChessUsername(e.target.value)}
                  placeholder="e.g. fromal09 on Lichess"
                  className="w-full bg-surface border border-border px-4 py-3 text-text-primary font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); }}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border hover:border-accent/40 transition-colors p-8 text-center cursor-pointer group"
                onClick={() => document.getElementById('pgn-file')?.click()}
              >
                <input
                  id="pgn-file"
                  type="file"
                  accept=".pgn"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="text-2xl text-accent/40 group-hover:text-accent/60 transition-colors mb-3">⬡</div>
                <p className="font-mono text-text-secondary text-sm">
                  Drop a .pgn file here or click to browse
                </p>
              </div>

              {/* PGN textarea */}
              <div>
                <label className="block font-mono text-xs text-text-muted mb-2 uppercase tracking-wider">
                  Or paste PGN
                </label>
                <textarea
                  value={pgn}
                  onChange={e => setPgn(e.target.value)}
                  rows={12}
                  placeholder={`[Event "Rated Game"]\n[White "You"]\n[Black "Opponent"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...`}
                  className="w-full bg-surface border border-border px-4 py-3 text-text-primary font-mono text-xs leading-relaxed focus:outline-none focus:border-accent/50 transition-colors resize-none"
                />
              </div>

              {error && (
                <p className="font-mono text-xs text-blunder bg-blunder/10 border border-blunder/20 px-4 py-3">
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!pgn.trim()}
                className="w-full py-3.5 bg-accent text-background font-mono text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze games →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Phase indicator */}
              <div className="flex items-center gap-3 font-mono text-sm">
                {phase === 'parsing' && <><span className="text-accent">◉</span> Parsing PGN…</>}
                {phase === 'uploading' && <><span className="text-accent">◉</span> Saving {parsedCount} game{parsedCount !== 1 ? 's' : ''}…</>}
                {phase === 'analyzing' && <><span className="text-accent">◉</span> Analyzing…</>}
                {phase === 'complete' && <><span className="text-excellent">✓</span> Analysis complete</>}
              </div>

              {/* Per-game progress */}
              {gameProgress.map(g => (
                <div key={g.gameId} className="bg-surface border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-text-secondary truncate max-w-xs">
                      {g.title}
                    </span>
                    <span className={`font-mono text-xs ${
                      g.phase === 'done' ? 'text-excellent' :
                      g.phase === 'error' ? 'text-blunder' :
                      g.phase === 'queued' ? 'text-text-muted' : 'text-accent'
                    }`}>
                      {g.phase === 'done' ? '✓ Done' :
                       g.phase === 'error' ? '✗ Failed' :
                       g.phase === 'queued' ? 'Queued' :
                       g.phase === 'saving' ? 'Saving…' :
                       `${g.current} / ${g.total} moves`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 bg-surface-2 overflow-hidden">
                    {g.phase === 'analyzing' || g.phase === 'saving' ? (
                      <div
                        className={`h-full transition-all duration-300 ${g.phase === 'saving' ? 'shimmer' : 'bg-accent'}`}
                        style={{ width: g.total > 0 ? `${(g.current / g.total) * 100}%` : '0%' }}
                      />
                    ) : g.phase === 'done' ? (
                      <div className="h-full bg-excellent w-full" />
                    ) : g.phase === 'error' ? (
                      <div className="h-full bg-blunder w-full" />
                    ) : (
                      <div className="h-full bg-border w-full" />
                    )}
                  </div>
                </div>
              ))}

              {phase === 'complete' && (
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 py-3 bg-accent text-background font-mono text-sm font-medium hover:bg-accent/90 transition-all"
                  >
                    View dashboard →
                  </button>
                  <button
                    onClick={() => { setPgn(''); setPhase('idle'); setGameProgress([]); }}
                    className="flex-1 py-3 border border-border text-text-secondary font-mono text-sm hover:border-accent/40 transition-all"
                  >
                    Upload more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
