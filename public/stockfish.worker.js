/**
 * ChessLens Analysis Worker
 * Primary:  Lichess Cloud Eval API (free, no auth, depth 20+)
 * Fallback: Returns null — future Stockfish WASM can slot in here
 *
 * UCI color convention: cp is always from the MOVING SIDE's perspective.
 * Lichess returns cp from White's perspective, so we flip for Black.
 */

const LICHESS_EVAL_URL = 'https://lichess.org/api/cloud-eval';
const LICHESS_RATE_LIMIT_MS = 150; // ~6 req/sec to be polite

let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const wait = LICHESS_RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestTime = Date.now();
}

async function getLichessEval(fen) {
  await rateLimit();
  try {
    const url = `${LICHESS_EVAL_URL}?fen=${encodeURIComponent(fen)}&multiPv=1`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.status === 429) {
      // Back off and retry once
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!retry.ok) return null;
      return await retry.json();
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extract centipawn value from Lichess eval response.
 * Returns value from the perspective of the side to move (color).
 */
function cpFromLichessEval(evalData, sideToMove) {
  const pv = evalData?.pvs?.[0];
  if (!pv) return null;

  if (pv.mate !== undefined) {
    // Mate score: large value, sign matches perspective
    const mateScore = pv.mate > 0 ? 10000 : -10000;
    return sideToMove === 'w' ? mateScore : -mateScore;
  }

  // Lichess cp is always from White's perspective
  const cp = typeof pv.cp === 'number' ? pv.cp : null;
  if (cp === null) return null;
  return sideToMove === 'w' ? cp : -cp;
}

function bestMoveFromLichessEval(evalData) {
  const moves = evalData?.pvs?.[0]?.moves;
  if (!moves) return null;
  return moves.split(' ')[0]; // first move of the PV
}

/**
 * Main analysis function for a single position.
 * Returns { cp, bestMove, source }
 */
async function analyzePosition(fen) {
  const lichessData = await getLichessEval(fen);

  if (lichessData) {
    // Extract side to move from FEN (field 2)
    const sideToMove = fen.split(' ')[1];
    const cp = cpFromLichessEval(lichessData, sideToMove);
    const bestMove = bestMoveFromLichessEval(lichessData);
    return { cp, bestMove, source: 'lichess' };
  }

  // Stockfish WASM fallback would go here.
  // To add it:
  //   1. Copy node_modules/stockfish/src/stockfish.js to /public/
  //   2. Uncomment and implement the UCI engine bridge below.
  return { cp: null, bestMove: null, source: 'none' };
}

// ----------------------------------------------------------------
// Message handler
// ----------------------------------------------------------------

self.onmessage = async (e) => {
  const { type, positions, gameId } = e.data;

  if (type === 'analyze_game') {
    /**
     * positions: Array<{ fen: string, ply: number, san: string, uci: string }>
     * We analyze position N+1 AFTER each move, then compute cp_loss = cp[N] - cp[N+1]
     * (both from the same player's perspective)
     */

    const results = [];
    let prevCp = null;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      self.postMessage({
        type: 'progress',
        gameId,
        current: i + 1,
        total: positions.length,
      });

      const { cp, bestMove, source } = await analyzePosition(pos.fenAfter);

      // cp_loss: how much the moving side lost by playing this move
      // prevCp is the eval BEFORE the move (from the moving side's view)
      // cp after the move is from the OPPONENT's view in fenAfter, so negate it
      // to get it back from the moving side's view
      const cpAfterFromMovingSide = cp !== null ? -cp : null;

      let cpLoss = null;
      if (prevCp !== null && cpAfterFromMovingSide !== null) {
        cpLoss = Math.max(0, prevCp - cpAfterFromMovingSide);
      }

      results.push({
        ply: pos.ply,
        san: pos.san,
        uci: pos.uci,
        fenBefore: pos.fenBefore,
        fenAfter: pos.fenAfter,
        cpBefore: prevCp,
        cpAfter: cpAfterFromMovingSide,
        cpLoss,
        bestMove,
        source,
      });

      // Next move's "before" = this move's "after" (negated to match side to move)
      prevCp = cpAfterFromMovingSide !== null ? -cpAfterFromMovingSide : null;
    }

    self.postMessage({ type: 'complete', gameId, results });
  }

  if (type === 'cancel') {
    // Future: abort controller for in-flight requests
    self.postMessage({ type: 'cancelled', gameId });
  }
};
