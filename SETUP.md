# ChessLens — Setup Guide

A free, self-hosted chess game analyzer. Upload PGNs, get move-by-move engine
analysis, piece activity heatmaps, accuracy trends, and blunder pattern tracking.

---

## Stack

| Layer       | Tool                         | Free tier notes               |
|-------------|------------------------------|-------------------------------|
| Framework   | Next.js 15 App Router        | —                             |
| Hosting     | Vercel Hobby                 | Free forever                  |
| Database    | Supabase (Postgres + Auth)   | 500MB · 50K MAU               |
| PGN parsing | chess.js                     | Client-side                   |
| Engine      | Lichess Cloud Eval API       | Free · no auth · depth 20+    |
| Board UI    | react-chessboard             | —                             |
| Charts      | Recharts                     | —                             |

---

## 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon key** (Project Settings > API)
3. In SQL Editor → New query → paste contents of `supabase/schema.sql` → Run

---

## 2. Clone / scaffold

```bash
# If starting fresh:
npx create-next-app@latest chesslens --typescript --tailwind --app --no-src-dir
# Then copy all files from this scaffold over the generated files

# Or if you have this scaffold:
cd chesslens
npm install
```

---

## 3. Environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

---

## 4. Configure Supabase Auth

In Supabase Dashboard > Authentication > URL Configuration:
- **Site URL**: `http://localhost:3000` (dev) / your Vercel URL (prod)
- **Redirect URLs**: Add both localhost and Vercel URLs

---

## 5. Run locally

```bash
npm run dev
# → http://localhost:3000
```

---

## 6. Deploy to Vercel

```bash
git init && git add . && git commit -m "init"
# Push to GitHub, then import repo in vercel.com
# Add environment variables in Vercel dashboard:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## How analysis works

1. User uploads PGN (paste or file)
2. `chess.js` parses it into positions (FEN at every ply)
3. A Web Worker sends each position to the **Lichess Cloud Eval API**
   - Free, depth 20+, covers most amateur game positions
   - Rate-limited to ~6 req/sec (worker handles this automatically)
4. Centipawn scores are stored in Supabase — **never recomputed**
5. Move classifications use standard thresholds (same as Lichess):
   - Excellent ≤10cp · Good ≤25cp · Inaccuracy ≤100cp
   - Mistake ≤300cp · Blunder 300cp+

---

## Directory structure

```
chesslens/
├── public/
│   └── stockfish.worker.js     ← Analysis web worker
├── src/
│   ├── app/
│   │   ├── layout.tsx           ← Root layout + fonts
│   │   ├── globals.css          ← Design tokens + base styles
│   │   ├── page.tsx             ← Landing + auth
│   │   ├── dashboard/
│   │   │   ├── page.tsx         ← Server component (data fetch)
│   │   │   └── DashboardClient.tsx ← Charts + game list
│   │   ├── upload/
│   │   │   └── page.tsx         ← PGN upload + analysis pipeline
│   │   └── games/
│   │       └── [id]/
│   │           ├── page.tsx     ← Server component
│   │           └── GameViewerClient.tsx ← Board + movelist + stats
│   ├── lib/
│   │   ├── analysis.ts          ← Chess logic, classification, aggregates
│   │   └── supabase.ts          ← Browser + server Supabase clients
│   ├── middleware.ts             ← Auth route protection
│   └── types/
│       └── database.ts          ← TypeScript types for Supabase schema
├── supabase/
│   └── schema.sql               ← Full DB schema with RLS
├── next.config.ts
├── tailwind.config.ts
├── .env.example
└── package.json
```

---

## Next pages to build (not scaffolded yet)

- `/games` — Paginated game list with filters (color, result, ECO)
- `/trends` — Blunder frequency chart, opening breakdown table
- `/openings` — Win% by ECO code
- Profile settings page (update chess username)

---

## Upgrading analysis (if Lichess API misses positions)

The worker (`public/stockfish.worker.js`) has a documented fallback stub.
To add Stockfish WASM locally:

```bash
npm install stockfish
cp node_modules/stockfish/src/stockfish.js public/
cp node_modules/stockfish/src/stockfish.wasm public/
```

Then implement the UCI bridge in the `// Stockfish WASM fallback` section
of the worker file. The existing message contract doesn't change.

---

## Supabase free tier limits

- **500MB database**: ~5M move_analysis rows → thousands of games
- **50K MAU**: more than enough for personal/small team use
- **No egress limits on database reads**

You will not hit limits in normal personal use.
