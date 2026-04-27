import { Chess } from 'chess.js';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type MoveClassification =
  | 'brilliant'
  | 'excellent'
  | 'good'
  | 'ok'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface RawMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface AnalyzedMove extends RawMove {
  cpBefore: number | null;
  cpAfter: number | null;
  cpLoss: number | null;
  bestMove: string | null;
  classification: MoveClassification;
  evalSource: 'lichess' | 'stockfish' | 'none';
}

export interface ParsedGame {
  headers: Record<string, string>;
  moves: RawMove[];
}

export interface GameAggregates {
  accuracy: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  goodMoves: number;
  excellentMoves: number;
  brilliantMoves: number;
  totalMovesAnalyzed: number;
  avgCpLoss: number;
  pieceActivity: Record<string, number>;
  squaresVisited: Record<string, number>;
}

// ----------------------------------------------------------------
// Move classification
// ----------------------------------------------------------------

const THRESHOLDS: Array<[number, MoveClassification]> = [
  [10,   'excellent'],
  [25,   'good'],
  [50,   'ok'],
  [100,  'inaccuracy'],
  [300,  'mistake'],
  [Infinity, 'blunder'],
];

export function classifyMove(cpLoss: number | null): MoveClassification {
  if (cpLoss === null) return 'ok';
  if (cpLoss <= 0) return 'excellent';
  for (const [threshold, label] of THRESHOLDS) {
    if (cpLoss <= threshold) return label;
  }
  return 'blunder';
}

// ----------------------------------------------------------------
// Accuracy formula (mirrors Chess.com / Lichess)
// win% = 50 + 50 * tanh(0.00368208 * cp)
// accuracy = avg(max(0, winBefore - winAfter)) mapped to 0-100
// ----------------------------------------------------------------

export function cpToWinPercent(cp: number): number {
  return 50 + 50 * Math.tanh(0.00368208 * cp);
}

export function computeAccuracy(analyzedMoves: AnalyzedMove[]): number {
  const withEval = analyzedMoves.filter(
    m => m.cpBefore !== null && m.cpAfter !== null
  );
  if (withEval.length === 0) return 0;

  const losses = withEval.map(m => {
    const winBefore = cpToWinPercent(m.cpBefore!);
    const winAfter  = cpToWinPercent(m.cpAfter!);
    return Math.max(0, winBefore - winAfter);
  });

  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  // Map to 0-100: 0 avg loss = 100% accuracy, 50 avg loss = ~0%
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));
}

// ----------------------------------------------------------------
// PGN Parsing
// ----------------------------------------------------------------

export function splitMultiGamePGN(pgn: string): string[] {
  const trimmed = pgn.trim();
  // Split on [Event that follows a game result line or start of string
  const chunks = trimmed.split(/(?=\[Event\s)/);
  return chunks.map(c => c.trim()).filter(c => c.startsWith('['));
}

export function parseSingleGame(pgn: string): ParsedGame | null {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn.trim());

    const headers = chess.header() as Record<string, string>;

    // Replay moves to capture FEN at each step
    const chess2 = new Chess();
    const verboseHistory = chess.history({ verbose: true });

    const moves: RawMove[] = verboseHistory.map((move, i) => {
      const fenBefore = chess2.fen();
      chess2.move(move.san);
      const fenAfter = chess2.fen();
      return {
        ply: i + 1,
        san: move.san,
        uci: move.from + move.to + (move.promotion ?? ''),
        fenBefore,
        fenAfter,
      };
    });

    return { headers, moves };
  } catch {
    return null;
  }
}

export function parseAllGames(pgn: string): ParsedGame[] {
  const chunks = splitMultiGamePGN(pgn);
  return chunks
    .map(chunk => parseSingleGame(chunk))
    .filter((g): g is ParsedGame => g !== null);
}

// ----------------------------------------------------------------
// Piece activity & heatmap
// ----------------------------------------------------------------

export function extractPieceActivity(
  moves: RawMove[],
  colorPlayed: 'white' | 'black'
): Record<string, number> {
  const activity: Record<string, number> = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
  const isWhite = colorPlayed === 'white';

  moves.forEach((m, i) => {
    // White moves on odd plies (1, 3, 5...), black on even plies (2, 4, 6...)
    const isWhiteMove = m.ply % 2 === 1;
    if (isWhite !== isWhiteMove) return;

    const firstChar = m.san[0];
    if ('NBRQK'.includes(firstChar)) {
      activity[firstChar]++;
    } else {
      activity['P']++;
    }
  });

  return activity;
}

export function extractSquaresVisited(
  moves: RawMove[],
  colorPlayed: 'white' | 'black'
): Record<string, number> {
  const squares: Record<string, number> = {};
  const isWhite = colorPlayed === 'white';

  moves.forEach(m => {
    const isWhiteMove = m.ply % 2 === 1;
    if (isWhite !== isWhiteMove) return;

    // Destination square from UCI
    const to = m.uci.slice(2, 4);
    if (to) squares[to] = (squares[to] ?? 0) + 1;
  });

  return squares;
}

// ----------------------------------------------------------------
// Aggregate stats from analyzed moves
// ----------------------------------------------------------------

export function computeAggregates(
  analyzedMoves: AnalyzedMove[],
  allMoves: RawMove[],
  colorPlayed: 'white' | 'black'
): GameAggregates {
  const isWhite = colorPlayed === 'white';
  const playerMoves = analyzedMoves.filter(m =>
    isWhite ? m.ply % 2 === 1 : m.ply % 2 === 0
  );

  const counts = {
    brilliant:   0,
    excellent:   0,
    good:        0,
    ok:          0,
    inaccuracy:  0,
    mistake:     0,
    blunder:     0,
  };

  let totalCpLoss = 0;
  let cpLossCount = 0;

  for (const m of playerMoves) {
    counts[m.classification]++;
    if (m.cpLoss !== null) {
      totalCpLoss += m.cpLoss;
      cpLossCount++;
    }
  }

  const accuracy = computeAccuracy(playerMoves);

  return {
    accuracy: Math.round(accuracy * 10) / 10,
    blunders: counts.blunder,
    mistakes: counts.mistake,
    inaccuracies: counts.inaccuracy,
    goodMoves: counts.good,
    excellentMoves: counts.excellent,
    brilliantMoves: counts.brilliant,
    totalMovesAnalyzed: playerMoves.filter(m => m.evalSource !== 'none').length,
    avgCpLoss: cpLossCount > 0 ? Math.round((totalCpLoss / cpLossCount) * 10) / 10 : 0,
    pieceActivity: extractPieceActivity(allMoves, colorPlayed),
    squaresVisited: extractSquaresVisited(allMoves, colorPlayed),
  };
}

// ----------------------------------------------------------------
// Determine which color the user played
// ----------------------------------------------------------------

export function detectColorPlayed(
  headers: Record<string, string>,
  chessUsername: string
): 'white' | 'black' | 'unknown' {
  if (!chessUsername) return 'unknown';
  const uname = chessUsername.toLowerCase();
  if (headers['White']?.toLowerCase() === uname) return 'white';
  if (headers['Black']?.toLowerCase() === uname) return 'black';
  return 'unknown';
}

// ----------------------------------------------------------------
// Opening / ECO helpers
// ----------------------------------------------------------------

export function formatResult(result: string, color: 'white' | 'black' | 'unknown'): string {
  if (color === 'unknown') return result;
  if (result === '1-0') return color === 'white' ? 'Win' : 'Loss';
  if (result === '0-1') return color === 'black' ? 'Win' : 'Loss';
  if (result === '1/2-1/2') return 'Draw';
  return result;
}

export function resultColor(result: string, color: 'white' | 'black' | 'unknown'): string {
  const fmt = formatResult(result, color);
  if (fmt === 'Win') return '#52c48a';
  if (fmt === 'Loss') return '#e05252';
  return '#888';
}

// ----------------------------------------------------------------
// Classification display helpers
// ----------------------------------------------------------------

export const CLASSIFICATION_META: Record<MoveClassification, { label: string; color: string; emoji: string }> = {
  brilliant:  { label: 'Brilliant',  color: '#a78bfa', emoji: '✦' },
  excellent:  { label: 'Excellent',  color: '#52c48a', emoji: '✓' },
  good:       { label: 'Good',       color: '#60a5fa', emoji: '·' },
  ok:         { label: 'OK',         color: '#888888', emoji: '' },
  inaccuracy: { label: 'Inaccuracy', color: '#fbbf24', emoji: '?!' },
  mistake:    { label: 'Mistake',    color: '#f97316', emoji: '?' },
  blunder:    { label: 'Blunder',    color: '#ef4444', emoji: '??' },
};
