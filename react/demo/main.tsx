import { Fragment, StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ORB_META, ORB_STATES, TyTalkOrb, type OrbState, type TyTalkOrbFrame } from '../TyTalkOrb';

const INFO: Record<OrbState, { vi: string; desc: string; spec: [string, string][] }> = {
  idle:      { vi: 'Idle · chờ', desc: 'Thở nhẹ, lơ lửng, thỉnh thoảng chớp mắt. Trạng thái mặc định.', spec: [['Thở', '±2.5% scale, 3.9 s'], ['Bob', '±4 px'], ['Mắt', 'viên thuốc, chớp 140 ms']] },
  talking:   { vi: 'Talking · nói', desc: 'Không có miệng. Thân scale lên xuống theo nhịp âm tiết, glow sáng theo.', spec: [['Scale', '1 → 1.09 theo biên độ'], ['Âm tiết', '80–200 ms'], ['Đầu vào', 'prop level 0..1 hoặc giả lập']] },
  working:   { vi: 'Working · xử lý', desc: 'Mắt nheo quét ngang như đang đọc dữ liệu, vòng cung quay quanh thân.', spec: [['Quét mắt', '±12 px'], ['Vòng quay', '1.1 vòng/s'], ['Mắt', 'scale Y 0.8']] },
  cute:      { vi: 'Cute · cười tít mắt', desc: 'Mắt cong "^ ^", má hồng, sao nhấp nháy. Đứng yên, chỉ thở nhẹ.', spec: [['Mắt', 'arc dày 12'], ['Thở', '±1.2%'], ['Phụ', 'má hồng, 4 tia sao']] },
  surprised: { vi: 'Surprised · ngạc nhiên', desc: 'Nảy bật lên một lần khi vào trạng thái, mắt kéo dài, hai chân mày cong phía trên.', spec: [['Pop', 'spring 1.16 → 1.04'], ['Mắt', 'scale Y 1.2'], ['Chân mày', 'cung mảnh']] },
  sleepy:    { vi: 'Sleepy · buồn ngủ', desc: 'Mắt khép thành đường cong thấp, thân chìm xuống, thở chậm, glow tối. Chữ z bay lên.', spec: [['Thở', '±4%, 7 s'], ['Chìm', '+6 px'], ['Glow', 'tối 30%']] },
  angry:     { vi: 'Angry · giận', desc: 'Chân mày chéo xuống, mắt vuông, thân rung nhanh, glow đỏ cam.', spec: [['Rung', '±2.4 px, 52 + 83 rad/s'], ['Mắt', 'vuông + chân mày chéo'], ['Màu', 'đỏ → cam']] },
  laugh:     { vi: 'Laugh · cười lớn', desc: 'Mắt "> <". Khuôn mặt ngước lên rồi cúi xuống theo nhịp cười, thân chỉ đi theo nhẹ và scale rất ít.', spec: [['Mặt ngước', '±10 px, 9 rad/s'], ['Thân', '±2.5 px, scale ±1.5%'], ['Nghiêng', '±2.5°']] },
  dizzy:     { vi: 'Dizzy · choáng', desc: 'Mắt "x x", thân đảo vòng và nghiêng chậm như quay cuồng. Dùng cho lỗi.', spec: [['Nghiêng', '±12°, 2.4 rad/s'], ['Quỹ đạo', '±6 × 4 px'], ['Màu', 'xanh lá']] },
};

/** Scripted tour through every state. */
const SCRIPT: { s: OrbState; ms: number; note: string }[] = [
  { s: 'idle', ms: 2200, note: 'chờ' },
  { s: 'surprised', ms: 2400, note: 'nhận được tin nhắn' },
  { s: 'working', ms: 3200, note: 'đang xử lý' },
  { s: 'talking', ms: 3400, note: 'trả lời' },
  { s: 'laugh', ms: 3200, note: 'vui' },
  { s: 'cute', ms: 2800, note: 'được khen' },
  { s: 'sleepy', ms: 3400, note: 'không ai nói chuyện' },
  { s: 'dizzy', ms: 2800, note: 'gặp lỗi' },
  { s: 'angry', ms: 2800, note: 'bị làm phiền' },
];
const RAPID_MS = 700;
const MAX = 480;

function Graph({ buf, color }: { buf: React.MutableRefObject<number[][]>; color: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!, ctx = c.getContext('2d')!;
    let raf = 0;
    const fit = () => { const r = c.getBoundingClientRect(), d = devicePixelRatio || 1; c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    const line = (i: number, lo: number, hi: number, col: string, W: number, H: number) => {
      ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
      buf.current.forEach((p, n) => { const v = (p[i] - lo) / (hi - lo), x = n / (MAX - 1) * W, y = H - 6 - v * (H - 12); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    };
    const draw = () => {
      const W = c.clientWidth, H = c.clientHeight; ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = '#25233a'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const y = 6 + i * (H - 12) / 4; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      // state-change markers
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([3, 4]); ctx.beginPath();
      buf.current.forEach((p, n) => { if (p[3]) { const x = n / (MAX - 1) * W; ctx.moveTo(x, 0); ctx.lineTo(x, H); } });
      ctx.stroke(); ctx.setLineDash([]);
      line(2, 0, 1, 'rgba(255,255,255,.35)', W, H);
      line(1, 16, -16, '#7fe9ff', W, H);
      line(0, 0.94, 1.18, color, W, H);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, [buf, color]);
  return <canvas ref={cv} aria-label="Đồ thị tín hiệu chuyển động" />;
}

type Mode = 'script' | 'rapid';

function App() {
  const [state, setState] = useState<OrbState>('idle');
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<Mode>('script');
  const [speed, setSpeed] = useState(1);
  const [step, setStep] = useState(0);
  const buf = useRef<number[][]>([]);
  const mark = useRef(false);
  const bar = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);
  const stateRef = useRef<OrbState>('idle');

  const go = useCallback((s: OrbState) => { mark.current = true; stateRef.current = s; setState(s); }, []);
  const onFrame = useCallback((f: TyTalkOrbFrame) => {
    buf.current.push([f.scale, f.y, f.glow, mark.current ? 1 : 0]); mark.current = false;
    if (buf.current.length > MAX) buf.current.shift();
  }, []);

  // flow player
  useEffect(() => {
    if (!playing) return;
    let raf = 0, start = performance.now();
    const loop = (now: number) => {
      const dur = mode === 'script' ? SCRIPT[stepRef.current].ms : RAPID_MS;
      const el = (now - start) * speed;
      if (bar.current) bar.current.style.width = Math.min(100, (el / dur) * 100) + '%';
      if (el >= dur) {
        start = now;
        if (mode === 'script') {
          stepRef.current = (stepRef.current + 1) % SCRIPT.length;
          setStep(stepRef.current); go(SCRIPT[stepRef.current].s);
        } else {
          const others = ORB_STATES.filter((x) => x !== stateRef.current);
          go(others[Math.floor(Math.random() * others.length)]);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    if (mode === 'script') { stepRef.current = step; go(SCRIPT[step].s); }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mode, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const i = '123456789'.indexOf(e.key); if (i > -1) { setPlaying(false); go(ORB_STATES[i]); } };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [go]);
  useEffect(() => { document.documentElement.style.setProperty('--glow', ORB_META[state].glow); }, [state]);

  const info = INFO[state], meta = ORB_META[state];
  const pick = (s: OrbState) => { setPlaying(false); go(s); };
  const jump = (i: number) => { stepRef.current = i; setStep(i); go(SCRIPT[i].s); setPlaying(true); setMode('script'); if (bar.current) bar.current.style.width = '0%'; };

  return (
    <div className="wrap">
      <header>
        <h1>TyTalk Orb</h1>
        <p>Nhân vật orb không miệng, 9 biểu cảm qua ánh mắt. Chạy chuỗi chuyển trạng thái bên dưới để xem độ mượt, các vạch đứt trên đồ thị đánh dấu lúc đổi.</p>
      </header>

      <section className="stage">
        <div className="badge"><i /><span>{state}</span></div>
        <div className="orb"><TyTalkOrb state={state} size="100%" onFrame={onFrame} /></div>
        <div className="tabs">
          {ORB_STATES.map((s, i) => (
            <button key={s} type="button" aria-pressed={s === state} onClick={() => pick(s)}>{s}<kbd>{i + 1}</kbd></button>
          ))}
        </div>
      </section>

      <aside className="side">
        <div className="card">
          <h2>Trạng thái</h2>
          <p id="name">{info.vi}</p>
          <p id="desc">{info.desc}</p>
          <dl>{info.spec.map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}</dl>
        </div>
        <div className="card">
          <h2>Motion graph · 8 giây gần nhất</h2>
          <Graph buf={buf} color={meta.glow} />
          <div className="legend"><span style={{ ['--c' as string]: meta.glow }}>scale</span><span style={{ ['--c' as string]: '#7fe9ff' }}>bob (y)</span><span style={{ ['--c' as string]: '#ffffff55' }}>glow</span><span style={{ ['--c' as string]: 'transparent', borderBottom: 0 }}>┆ đổi trạng thái</span></div>
        </div>
      </aside>

      <section className="card flow">
        <div className="flow-head">
          <h2>Chuỗi chuyển trạng thái</h2>
          <div className="flow-ctl">
            <button type="button" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Tạm dừng' : 'Chạy'}</button>
            <button type="button" aria-pressed={mode === 'script'} onClick={() => { setMode('script'); setPlaying(true); }}>Kịch bản</button>
            <button type="button" aria-pressed={mode === 'rapid'} onClick={() => { setMode('rapid'); setPlaying(true); }}>Đổi liên tục 0.7 s</button>
            {[0.5, 1, 2].map((x) => (<button key={x} type="button" aria-pressed={speed === x} onClick={() => setSpeed(x)}>{x}×</button>))}
          </div>
        </div>
        <ol className="chain">
          {SCRIPT.map((c, i) => (
            <li key={c.s}>
              <button type="button" className="chip" aria-pressed={mode === 'script' && i === step} onClick={() => jump(i)}>
                <span className="chip-n">{c.s}</span><span className="chip-d">{c.note}</span>
                {mode === 'script' && i === step && <div className="chip-bar"><div ref={bar} /></div>}
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
