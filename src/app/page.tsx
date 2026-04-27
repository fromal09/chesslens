'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type Piece = string | null;
type Board = Piece[][];

const INITIAL_BOARD: Board = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

const PIECE_GLYPHS: Record<string, string> = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
};

interface Target {
  row: number; col: number;
  notation: string; label: string;
  action: 'signin' | 'signup' | 'scroll';
  flavor: string;
  fromRow: number; fromCol: number;
}

const TARGETS: Target[] = [
  { row:4, col:4, notation:'1. e4', label:'Sign In',        action:'signin', flavor:'The classical choice',    fromRow:6, fromCol:4 },
  { row:4, col:3, notation:'1. d4', label:'Create Account', action:'signup', flavor:'Build your foundation',  fromRow:6, fromCol:3 },
  { row:5, col:5, notation:'1. Nf3', label:'Explore',        action:'scroll', flavor:'The hypermodern way',    fromRow:7, fromCol:6 },
];

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

export default function HomePage() {
  const [board, setBoard] = useState<Board>(INITIAL_BOARD.map(r => [...r]));
  const [selected, setSelected] = useState<{row:number;col:number}|null>(null);
  const [movedTo, setMovedTo] = useState<{row:number;col:number}|null>(null);
  const [modal, setModal] = useState<'signin'|'signup'|null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hintTarget, setHintTarget] = useState<number|null>(0);
  const featuresRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard');
    });
    let i = 0;
    const interval = setInterval(() => {
      setHintTarget(i % 3);
      i++;
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  function getTarget(row: number, col: number): Target | undefined {
    return TARGETS.find(t => t.row === row && t.col === col);
  }

  function isValidTarget(row: number, col: number): boolean {
    if (!selected) return false;
    return TARGETS.some(t => t.row === row && t.col === col && t.fromRow === selected.row && t.fromCol === selected.col);
  }

  function handleSquareClick(row: number, col: number) {
    const piece = board[row][col];
    if (piece?.startsWith('w')) {
      const isMovable = TARGETS.some(t => t.fromRow === row && t.fromCol === col);
      if (isMovable) { setSelected({ row, col }); return; }
    }
    if (selected && isValidTarget(row, col)) {
      const target = getTarget(row, col)!;
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = newBoard[selected.row][selected.col];
      newBoard[selected.row][selected.col] = null;
      setBoard(newBoard);
      setMovedTo({ row, col });
      setSelected(null);
      setTimeout(() => {
        if (target.action === 'scroll') featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
        else setModal(target.action);
      }, 350);
      return;
    }
    setSelected(null);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (modal === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/dashboard');
    }
    setLoading(false);
  }

  function closeModal() {
    setModal(null); setEmail(''); setPassword(''); setError(''); setMessage('');
    setBoard(INITIAL_BOARD.map(r => [...r])); setMovedTo(null);
  }

  const SQ = 64;

  return (
    <div style={{ minHeight:'100vh', background:'#080810', color:'#e8e2d6', fontFamily:'var(--font-body,Georgia,serif)', overflowX:'hidden' }}>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        backgroundImage:'linear-gradient(rgba(201,160,80,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,160,80,0.03) 1px,transparent 1px)',
        backgroundSize:'80px 80px' }} />
      <div style={{ position:'fixed', top:'-5%', left:'50%', transform:'translateX(-50%)', width:'800px', height:'500px',
        background:'radial-gradient(ellipse,rgba(201,160,80,0.07) 0%,transparent 68%)', pointerEvents:'none', zIndex:0 }} />

      {/* Nav */}
      <nav style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'1.25rem 2.5rem', borderBottom:'1px solid rgba(201,160,80,0.1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <div style={{ width:26, height:26, border:'1px solid rgba(201,160,80,0.5)', transform:'rotate(45deg)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ transform:'rotate(-45deg)', color:'#c9a050', fontSize:12, lineHeight:1 }}>♟</span>
          </div>
          <span style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:'1.2rem', fontWeight:600, letterSpacing:'-0.02em' }}>ChessLens</span>
        </div>
        <div style={{ display:'flex', gap:'1.25rem', alignItems:'center' }}>
          <button onClick={() => setModal('signin')} style={{ background:'none', border:'none', color:'#9a9490',
            fontFamily:'var(--font-mono,monospace)', fontSize:11, cursor:'pointer', letterSpacing:'0.08em' }}>Sign in</button>
          <button onClick={() => setModal('signup')} style={{ background:'rgba(201,160,80,0.1)', border:'1px solid rgba(201,160,80,0.3)',
            color:'#c9a050', fontFamily:'var(--font-mono,monospace)', fontSize:11, cursor:'pointer', padding:'0.45rem 0.9rem', letterSpacing:'0.06em' }}>
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', padding:'3.5rem 2rem 5rem' }}>
        <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'rgba(201,160,80,0.55)',
          letterSpacing:'0.35em', textTransform:'uppercase', marginBottom:'1.25rem' }}>
          Free · No ads · Engine analysis
        </div>
        <h1 style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:'clamp(2.2rem,5.5vw,4rem)',
          fontWeight:700, textAlign:'center', lineHeight:1.06, marginBottom:'0.875rem', maxWidth:640 }}>
          Your chess,{' '}
          <span style={{ background:'linear-gradient(135deg,#c9a050,#f0d88a)', WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent', backgroundClip:'text' }}>seen clearly</span>
        </h1>
        <p style={{ color:'#9a9490', fontSize:'1rem', textAlign:'center', maxWidth:460, lineHeight:1.7, marginBottom:'2.5rem' }}>
          Upload your PGNs. Every move analyzed, every blunder explained, every pattern tracked.
        </p>

        <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:11, color:'rgba(201,160,80,0.45)',
          letterSpacing:'0.12em', marginBottom:'1.75rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span style={{ display:'inline-block', width:5, height:5, background:'#c9a050', borderRadius:'50%',
            animation:'pulseDot 1.8s ease-in-out infinite' }} />
          Select a piece · Make your move
        </div>

        {/* Board */}
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', paddingLeft:24, marginBottom:3 }}>
            {FILES.map(f => (
              <div key={f} style={{ width:SQ, textAlign:'center', fontFamily:'var(--font-mono,monospace)',
                fontSize:9, color:'rgba(201,160,80,0.28)', letterSpacing:'0.1em' }}>{f}</div>
            ))}
          </div>
          <div style={{ display:'flex' }}>
            <div style={{ display:'flex', flexDirection:'column', width:20, paddingRight:4 }}>
              {RANKS.map(r => (
                <div key={r} style={{ height:SQ, display:'flex', alignItems:'center',
                  fontFamily:'var(--font-mono,monospace)', fontSize:9, color:'rgba(201,160,80,0.28)' }}>{r}</div>
              ))}
            </div>

            <div style={{ position:'relative', width:SQ*8, height:SQ*8,
              boxShadow:'0 0 80px rgba(0,0,0,0.9), 0 0 160px rgba(201,160,80,0.06)',
              border:'1px solid rgba(201,160,80,0.12)' }}>

              {/* Floating labels */}
              {TARGETS.map((t, i) => {
                const isActiveSelection = selected && t.fromRow === selected.row && t.fromCol === selected.col;
                const isHinted = hintTarget === i && !selected;
                const show = !!(isActiveSelection || isHinted);
                return (
                  <div key={i} style={{ position:'absolute', left:t.col*SQ + SQ/2, top:t.row*SQ - (show ? 92 : 72),
                    transform:'translateX(-50%)', zIndex:20, pointerEvents:'none',
                    opacity: show ? 1 : 0, transition:'all 0.38s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <div style={{ background:'rgba(8,8,16,0.97)', border:`1px solid ${isActiveSelection ? 'rgba(201,160,80,0.7)' : 'rgba(201,160,80,0.25)'}`,
                      padding:'0.45rem 0.7rem', textAlign:'center', whiteSpace:'nowrap' }}>
                      <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:9, color:'rgba(201,160,80,0.55)',
                        letterSpacing:'0.12em', marginBottom:2 }}>{t.notation}</div>
                      <div style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:13, fontWeight:600, color:'#e8e2d6', marginBottom:2 }}>{t.label}</div>
                      <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:8, color:'#5a5655', fontStyle:'italic' }}>{t.flavor}</div>
                    </div>
                    <div style={{ width:0, height:0, borderLeft:'4px solid transparent', borderRight:'4px solid transparent',
                      borderTop:`4px solid ${isActiveSelection ? 'rgba(201,160,80,0.7)' : 'rgba(201,160,80,0.25)'}`,
                      margin:'0 auto' }} />
                  </div>
                );
              })}

              {/* Squares */}
              {board.map((rowArr, row) =>
                rowArr.map((piece, col) => {
                  const isLight = (row+col)%2===0;
                  const isSel = selected?.row===row && selected?.col===col;
                  const isTgt = isValidTarget(row, col);
                  const isDone = movedTo?.row===row && movedTo?.col===col;
                  const isHintSq = hintTarget!==null && TARGETS[hintTarget]?.row===row && TARGETS[hintTarget]?.col===col && !selected;
                  const isMovable = !selected && TARGETS.some(t => t.fromRow===row && t.fromCol===col);

                  let bg = isLight ? '#e8d5b0' : '#8b6344';
                  if (isSel) bg = '#c9a050';
                  else if (isTgt) bg = isLight ? '#d4a843' : '#b8922e';
                  else if (isDone) bg = isLight ? '#cdb87a' : '#9e7a3a';
                  else if (isHintSq) bg = isLight ? '#d0b278' : '#a07a3c';

                  return (
                    <div key={`${row}-${col}`} onClick={() => handleSquareClick(row, col)}
                      style={{ position:'absolute', left:col*SQ, top:row*SQ, width:SQ, height:SQ,
                        background:bg, display:'flex', alignItems:'center', justifyContent:'center',
                        cursor:(isMovable||(selected&&isTgt))?'pointer':'default',
                        transition:'background 0.15s ease', userSelect:'none' }}>

                      {(isTgt||isHintSq) && (
                        <div style={{ position:'absolute', inset:3,
                          border:`2px solid rgba(201,160,80,${isTgt?0.9:0.45})`,
                          animation:isTgt?'tgtPulse 0.9s ease-in-out infinite alternate':'hintPulse 2.2s ease-in-out infinite' }} />
                      )}

                      {piece && (
                        <span style={{ fontSize:38, lineHeight:1, position:'relative', zIndex:2,
                          color:piece.startsWith('w')?'#ffffff':'#120c04',
                          textShadow:piece.startsWith('w')
                            ?`0 1px 4px rgba(0,0,0,0.9),0 0 1px rgba(0,0,0,1)${isSel?',0 0 16px rgba(255,215,80,0.5)':''}`
                            :'0 1px 3px rgba(255,255,255,0.15)',
                          filter:piece.startsWith('b')?'brightness(0.65)':'none',
                          transform:isSel?'scale(1.18) translateY(-5px)':'scale(1)',
                          transition:'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                          cursor:isMovable?'grab':'default' }}>
                          {PIECE_GLYPHS[piece]}
                        </span>
                      )}
                      {isTgt && !piece && (
                        <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(201,160,80,0.45)', position:'absolute' }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop:'3rem', fontFamily:'var(--font-mono,monospace)', fontSize:10,
          color:'rgba(201,160,80,0.28)', letterSpacing:'0.2em', textAlign:'center' }}>
          ↓ or scroll to explore ↓
        </div>
      </main>

      {/* Features */}
      <div ref={featuresRef} style={{ position:'relative', zIndex:10, borderTop:'1px solid rgba(201,160,80,0.08)',
        maxWidth:1000, margin:'0 auto', padding:'4rem 2rem 8rem' }}>
        <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'rgba(201,160,80,0.38)',
          letterSpacing:'0.3em', textTransform:'uppercase', textAlign:'center', marginBottom:'3rem' }}>
          What ChessLens gives you
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'1px', background:'rgba(201,160,80,0.08)' }}>
          {[
            { icon:'⬡', title:'Move-by-move analysis', desc:'Every ply classified via Lichess cloud eval — blunders, mistakes, brilliant finds — stored once, never recomputed.' },
            { icon:'◈', title:'Piece activity radar', desc:'See which pieces you actually use vs. leave dormant across any game or your full history.' },
            { icon:'◉', title:'Accuracy trends', desc:'Your chess quality over time — not just results, but how well you actually played each game.' },
            { icon:'▦', title:'Board heatmaps', desc:'Which squares do you control, avoid, or consistently overlook? Now you will know.' },
            { icon:'◫', title:'Opening breakdown', desc:'Win rate, avg accuracy, and blunder frequency by ECO code across all your uploaded games.' },
            { icon:'⟁', title:'Pattern recognition', desc:'Track recurring weaknesses across games — not individual blunders, but systemic habits.' },
          ].map((f, i) => (
            <div key={i} style={{ background:'#111113', padding:'2rem', transition:'background 0.2s', cursor:'default' }}
              onMouseEnter={e => (e.currentTarget.style.background='#16161a')}
              onMouseLeave={e => (e.currentTarget.style.background='#111113')}>
              <div style={{ fontSize:18, color:'#c9a050', marginBottom:'1rem' }}>{f.icon}</div>
              <div style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:'0.95rem', fontWeight:600, color:'#e8e2d6', marginBottom:'0.5rem' }}>{f.title}</div>
              <div style={{ fontSize:'0.825rem', color:'#9a9490', lineHeight:1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target===e.currentTarget) closeModal(); }}
          style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(4,4,8,0.88)',
            display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)' }}>
          <div style={{ background:'#0f0f12', border:'1px solid rgba(201,160,80,0.2)', width:'100%', maxWidth:410,
            margin:'1rem', padding:'2.25rem', animation:'slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.7rem', marginBottom:'1.75rem' }}>
              <div style={{ width:20, height:20, border:'1px solid rgba(201,160,80,0.45)', transform:'rotate(45deg)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ transform:'rotate(-45deg)', color:'#c9a050', fontSize:10 }}>♟</span>
              </div>
              <span style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:'1.05rem', fontWeight:600 }}>
                {modal==='signup' ? 'Begin your study' : 'Continue your study'}
              </span>
            </div>
            <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'rgba(201,160,80,0.45)',
              marginBottom:'1.5rem', letterSpacing:'0.1em' }}>
              {modal==='signup' ? '1. d4 — The positional approach' : '1. e4 — The classical player'}
            </div>
            {message ? (
              <div style={{ background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.25)',
                color:'#34d399', fontFamily:'var(--font-mono,monospace)', fontSize:12, padding:'1rem', lineHeight:1.6 }}>
                {message}
                <div style={{ marginTop:'1rem' }}>
                  <button onClick={() => { setMessage(''); setModal('signin'); }}
                    style={{ background:'#c9a050', border:'none', color:'#080810', fontFamily:'var(--font-mono,monospace)',
                      fontSize:11, padding:'0.45rem 0.9rem', cursor:'pointer', fontWeight:600, letterSpacing:'0.06em' }}>
                    Sign in →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuth} style={{ display:'flex', flexDirection:'column', gap:'0.9rem' }}>
                {[
                  { label:'Email', type:'email', val:email, setter:setEmail, ph:'you@example.com' },
                  { label:'Password', type:'password', val:password, setter:setPassword, ph:'••••••••' },
                ].map(({ label, type, val, setter, ph }) => (
                  <div key={label}>
                    <label style={{ display:'block', fontFamily:'var(--font-mono,monospace)', fontSize:9,
                      color:'#5a5655', marginBottom:5, letterSpacing:'0.2em', textTransform:'uppercase' }}>{label}</label>
                    <input type={type} value={val} onChange={e => setter(e.target.value)} required
                      placeholder={ph} minLength={type==='password'?8:undefined}
                      style={{ width:'100%', background:'#18181c', border:'1px solid #2a2a30', padding:'0.7rem 0.9rem',
                        color:'#e8e2d6', fontFamily:'var(--font-mono,monospace)', fontSize:12, outline:'none',
                        boxSizing:'border-box', transition:'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderColor='rgba(201,160,80,0.5)'}
                      onBlur={e => e.target.style.borderColor='#2a2a30'} />
                  </div>
                ))}
                {error && (
                  <div style={{ fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'#ef4444',
                    background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', padding:'0.65rem 0.75rem' }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  style={{ background:'#c9a050', border:'none', color:'#080810', fontFamily:'var(--font-mono,monospace)',
                    fontSize:12, fontWeight:700, padding:'0.8rem', cursor:loading?'not-allowed':'pointer',
                    opacity:loading?0.6:1, letterSpacing:'0.06em', marginTop:'0.25rem' }}>
                  {loading ? 'Loading…' : modal==='signup' ? 'Create account →' : 'Sign in →'}
                </button>
                <div style={{ textAlign:'center', fontFamily:'var(--font-mono,monospace)', fontSize:10, color:'#5a5655' }}>
                  {modal==='signup' ? 'Already studying? ' : 'New here? '}
                  <button type="button" onClick={() => { setModal(modal==='signup'?'signin':'signup'); setError(''); }}
                    style={{ background:'none', border:'none', color:'#c9a050', fontFamily:'var(--font-mono,monospace)',
                      fontSize:10, cursor:'pointer', textDecoration:'underline' }}>
                    {modal==='signup' ? 'Sign in' : 'Create account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
        @keyframes tgtPulse { from{opacity:.55;box-shadow:0 0 0 0 rgba(201,160,80,.35)} to{opacity:1;box-shadow:0 0 0 6px rgba(201,160,80,0)} }
        @keyframes hintPulse { 0%,100%{opacity:.25} 50%{opacity:.65} }
        @keyframes slideUp { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
}
