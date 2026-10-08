// camadas de "mundo" da edicao: camera (cortes, zooms, jump-cut), pessoa recortada, fundos novos,
// elementos flutuantes, texto atras da pessoa, texto 3D, tela dividida, efeitos de tratamento e
// transicoes. A composicao (Edicao.jsx) empilha tudo na ordem certa de profundidade.
import React from 'react';
import {
  AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';

// escala de layout: tudo foi desenhado pra 1080px no menor lado
export const useUnidade = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

export const sombraTexto = (e, u, forte = false) => {
  if (e.contorno) {
    const s = Math.round((forte ? 7 : 5) * u);
    return `0 0 ${s}px rgba(0,0,0,0.9), 0 ${s / 2}px ${s * 1.5}px rgba(0,0,0,0.75)`;
  }
  if (e.brilho) return `0 0 ${18 * u}px ${e.corDestaque}88, 0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.6)`;
  return `0 ${3 * u}px ${14 * u}px rgba(0,0,0,0.55)`;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const ativoEm = (lista, frame) => lista.filter((x) => frame >= x.inicio && frame < x.fim);
// entra/sai suave (0..1) dentro de um intervalo
const presenca = (x, frame, borda = 8) => interpolate(frame, [x.inicio, x.inicio + borda, x.fim - borda, x.fim], [0, 1, 1, 0], clamp);
// "aleatorio" deterministico por quadro (render e paralelo/repetivel)
const ruido = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// ---------- camera: cortes + zooms de enfase + deriva lenta + jump-cut ----------

function fatorZoom(frame, zooms, fps, e) {
  let fator = 1;
  for (const z of zooms) {
    const t = frame - z.frame;
    if (t < 0 || t > fps * 3.2) continue;
    if (z.tipo === 'soco') {
      const entrada = spring({ frame: t, fps, config: { damping: 14, stiffness: 180 } });
      const saida = interpolate(t, [fps * 1.4, fps * 1.9], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
      fator = Math.max(fator, 1 + (e.zoomSoco - 1) * entrada * (1 - saida));
    } else if (z.tipo === 'dramatico') {
      const entrada = interpolate(t, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.exp) });
      const saida = interpolate(t, [fps * 1.6, fps * 2.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
      fator = Math.max(fator, 1 + 0.32 * entrada * (1 - saida));
    } else {
      const ida = interpolate(t, [0, fps * 2.6], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) });
      const volta = interpolate(t, [fps * 2.6, fps * 3.2], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
      fator = Math.max(fator, 1 + 0.1 * ida * (1 - volta));
    }
  }
  return fator;
}

export function escalaCamera(frame, fps, segmentos, zooms, estilo) {
  const seg = segmentos.find((s) => frame >= s.outInicio && frame < s.outInicio + s.duracao) || segmentos[segmentos.length - 1];
  const progressoSeg = seg ? (frame - seg.outInicio) / Math.max(1, seg.duracao) : 0;
  return (seg?.escala || 1) * (1 + 0.025 * progressoSeg) * fatorZoom(frame, zooms, fps, estilo);
}

// os cortes do video. "trechos" limita a renderizacao a alguns intervalos (usado na camada da
// pessoa recortada, que so precisa existir onde tem algo atras dela)
export function CamadaVideo({ src, segmentos, zooms, estilo, filtro = '', transparente = false, trechos = null, mudo = false }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escala = escalaCamera(frame, fps, segmentos, zooms, estilo);
  const pedacos = [];
  for (const s of segmentos) {
    const janelas = trechos || [[s.outInicio, s.outInicio + s.duracao]];
    for (const [a, b] of janelas) {
      const ini = Math.max(a, s.outInicio);
      const fim = Math.min(b, s.outInicio + s.duracao);
      if (fim - ini < 1) continue;
      pedacos.push({ ini, dur: fim - ini, trim: s.srcInicioFrame + (ini - s.outInicio), seg: s, inicioSeg: ini === s.outInicio, fimSeg: fim === s.outInicio + s.duracao });
    }
  }
  return (
    <AbsoluteFill style={{ transform: `scale(${escala})`, transformOrigin: '50% 38%', filter: `${estilo.filtroVideo} ${filtro}`.trim() }}>
      {pedacos.map((p, i) => (
        <Sequence key={i} from={p.ini} durationInFrames={p.dur} layout="none">
          <OffthreadVideo
            src={src}
            trimBefore={p.trim}
            transparent={transparente}
            muted={mudo}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            // micro fade de audio nas bordas do corte - evita o "clique" de cortar no meio da onda
            volume={mudo ? 0 : (f) => interpolate(f, [0, 2, p.dur - 2, p.dur], [p.inicioSeg ? 0 : 1, 1, 1, p.fimSeg ? 0 : 1], clamp)}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

// ---------- fundo novo (atras da pessoa recortada) ----------

export function Fundos({ fundos, estilo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return ativoEm(fundos, frame).filter((f) => f.tipo !== 'desfocado').map((f, i) => {
    const op = presenca(f, frame, 9);
    const t = (frame - f.inicio) / fps;
    let conteudo = null;
    if (f.tipo === 'imagem' && f.src) {
      const kb = interpolate(frame, [f.inicio, f.fim], [1.06, 1.16]);
      conteudo = f.kind === 'video'
        ? <OffthreadVideo src={f.src} muted trimBefore={0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Img src={f.src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})` }} />;
    } else if (f.tipo === 'gradiente') {
      const ang = 135 + Math.sin(t * 0.6) * 25;
      conteudo = (
        <AbsoluteFill style={{ background: `linear-gradient(${ang}deg, #0b0614 0%, ${estilo.corDestaque}cc ${45 + Math.sin(t) * 10}%, ${estilo.corSecundaria || '#ffffff'}88 100%)` }}>
          <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(t * 0.7) * 20}% ${40 + Math.cos(t * 0.5) * 15}%, rgba(255,255,255,0.22), rgba(0,0,0,0) 45%)` }} />
        </AbsoluteFill>
      );
    } else {
      conteudo = <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, ${estilo.corDestaque}55 0%, #050308 55%, #000 100%)` }} />;
    }
    return <AbsoluteFill key={i} style={{ opacity: op, backgroundColor: '#000' }}>{conteudo}</AbsoluteFill>;
  });
}

// trechos em que o VIDEO BASE deve ficar desfocado (profundidade de campo / fundo desfocado)
export function desfoqueBase(frame, fundos, efeitos) {
  let b = 0;
  for (const f of ativoEm(fundos, frame)) if (f.tipo === 'desfocado') b = Math.max(b, 22 * presenca(f, frame, 9));
  for (const e of ativoEm(efeitos, frame)) if (e.tipo === 'desfoque_fundo') b = Math.max(b, 14 * presenca(e, frame, 9));
  return b;
}

// ---------- elementos flutuantes (imagens geradas, de preferencia recortadas) ----------

const POSICOES = {
  esquerda: { left: '3%', top: '24%', width: '46%' },
  direita: { right: '3%', top: '24%', width: '46%' },
  centro: { left: '22%', top: '16%', width: '56%' },
  topo: { left: '26%', top: '5%', width: '48%' },
};

export function Elementos({ elementos }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useUnidade();
  return ativoEm(elementos, frame).map((e, i) => {
    const t = frame - e.inicio;
    const op = presenca(e, frame, 7);
    const entrada = spring({ frame: t, fps, config: { damping: 13, stiffness: 120 } });
    let transform = `translateY(${Math.sin(t / 18) * 14 * u}px) rotate(${Math.sin(t / 25) * 3}deg) scale(${0.7 + 0.3 * entrada})`;
    if (e.movimento === 'girar') transform = `perspective(${1400 * u}px) rotateY(${(t * 3) % 360}deg) translateY(${Math.sin(t / 20) * 10 * u}px) scale(${0.7 + 0.3 * entrada})`;
    if (e.movimento === 'entrar') transform = `scale(${0.2 + 0.8 * entrada}) rotate(${(1 - entrada) * -25}deg) translateY(${(1 - entrada) * 120 * u}px)`;
    const pos = POSICOES[e.posicao] || POSICOES.direita;
    return (
      <div key={i} style={{ position: 'absolute', ...pos, opacity: op, transform, filter: `drop-shadow(0 ${24 * u}px ${36 * u}px rgba(0,0,0,0.55))` }}>
        <Img src={e.src} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
    );
  });
}

// ---------- texto 3D (extrusao com sombras empilhadas + perspectiva) ----------

function corMaisEscura(hex, fator = 0.45) {
  const n = parseInt((hex || '#888888').slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * fator);
  const g = Math.round(((n >> 8) & 255) * fator);
  const b = Math.round((n & 255) * fator);
  return `rgb(${r},${g},${b})`;
}

function extrusao(cor, u, camadas = 14) {
  const sombras = [];
  for (let k = 1; k <= camadas; k++) sombras.push(`${k * 1.1 * u}px ${k * 1.4 * u}px 0 ${cor}`);
  sombras.push(`${camadas * 1.4 * u}px ${camadas * 2.2 * u}px ${28 * u}px rgba(0,0,0,0.55)`);
  return sombras.join(', ');
}

export function Texto3D({ texto, duracao, estilo, media }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const entrada = spring({ frame, fps, config: { damping: 11, stiffness: 110 } });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], clamp);
  const rotY = interpolate(entrada, [0, 1], [-75, 0]) + Math.sin(frame / 22) * 9;
  const rotX = 14 + Math.sin(frame / 30) * 4;
  // letra pesada ocupa ~0.8em: limita pra palavra caber inteira na largura (com a extrusao)
  const tamanho = Math.min(210, 1250 / Math.max(4, texto.length)) * u;
  return (
    <AbsoluteFill style={{ alignItems: 'center', perspective: `${1600 * u}px` }}>
      <div style={{
        position: 'absolute', top: height * (media ? 0.4 : 0.12), width: '92%', textAlign: 'center',
        fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: tamanho, lineHeight: 0.95, textTransform: 'uppercase',
        color: estilo.corDestaque, textShadow: extrusao(corMaisEscura(estilo.corDestaque), u),
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${0.6 + 0.4 * entrada})`, opacity: Math.min(1, entrada * 1.5) * saida,
      }}>{texto}</div>
    </AbsoluteFill>
  );
}

// ---------- texto GIGANTE passando por tras da pessoa ----------

export function TextosAtras({ textos, estilo }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const u = useUnidade();
  return ativoEm(textos, frame).map((x, i) => {
    const dur = x.fim - x.inicio;
    const t = frame - x.inicio;
    const op = presenca(x, frame, 8);
    const tamanho = Math.min(420, 3400 / Math.max(3, x.texto.length)) * u;
    const entrada = spring({ frame: t, fps, config: { damping: 14, stiffness: 90 } });
    let transform = '';
    if (x.movimento === 'deslizar') transform = `translateX(${interpolate(t, [0, dur], [width * 0.55, -width * 0.55])}px)`;
    else if (x.movimento === 'subir') transform = `translateY(${(1 - entrada) * height * 0.25}px)`;
    else if (x.movimento === 'zoom') transform = `scale(${interpolate(t, [0, dur], [0.75, 1.15])})`;
    else transform = `perspective(${1500 * u}px) rotateY(${interpolate(entrada, [0, 1], [-80, 0]) + Math.sin(t / 20) * 8}deg)`;
    return (
      <AbsoluteFill key={i} style={{ alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: height * 0.17, whiteSpace: 'nowrap', textAlign: 'center',
          fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: tamanho, lineHeight: 0.9, textTransform: 'uppercase',
          color: estilo.corDestaque, opacity: op, transform, letterSpacing: -2 * u,
          textShadow: x.movimento === 'giro3d' ? extrusao(corMaisEscura(estilo.corDestaque), u, 10) : `0 0 ${40 * u}px ${estilo.corDestaque}66`,
        }}>{x.texto}</div>
      </AbsoluteFill>
    );
  });
}

// ---------- tela dividida ----------

export function Divisoes({ divisoes, estilo, videoPessoa }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useUnidade();
  return ativoEm(divisoes, frame).map((d, i) => {
    const t = frame - d.inicio;
    const entrada = spring({ frame: t, fps, config: { damping: 16, stiffness: 140 } });
    const saida = interpolate(frame, [d.fim - 7, d.fim], [1, 0], clamp);
    const midia = (estiloMidia) => (d.kind === 'video'
      ? <OffthreadVideo src={d.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover', ...estiloMidia }} />
      : <Img src={d.src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(t, [0, d.fim - d.inicio], [1.04, 1.12])})`, ...estiloMidia }} />);
    if (d.layout === 'janela_pessoa') {
      return (
        <AbsoluteFill key={i} style={{ opacity: saida }}>
          <AbsoluteFill style={{ opacity: Math.min(1, entrada * 1.3), transform: `scale(${1.1 - 0.1 * entrada})` }}>{midia()}</AbsoluteFill>
          <div style={{
            position: 'absolute', right: '6%', bottom: '24%', width: '40%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden',
            border: `${6 * u}px solid ${estilo.corDestaque}`, boxShadow: `0 ${16 * u}px ${40 * u}px rgba(0,0,0,0.6)`,
            transform: `scale(${entrada})`,
          }}>
            <div style={{ position: 'absolute', inset: 0 }}>{videoPessoa}</div>
          </div>
        </AbsoluteFill>
      );
    }
    const lado = d.layout === 'lado_a_lado';
    const painel = lado
      ? { top: 0, bottom: 0, right: 0, width: '50%', transform: `translateX(${(1 - entrada) * 100}%)`, borderLeft: `${5 * u}px solid ${estilo.corDestaque}` }
      : { left: 0, right: 0, bottom: 0, height: '48%', transform: `translateY(${(1 - entrada) * 100}%)`, borderTop: `${5 * u}px solid ${estilo.corDestaque}` };
    return (
      <div key={i} style={{ position: 'absolute', overflow: 'hidden', opacity: saida, boxShadow: `0 0 ${50 * u}px rgba(0,0,0,0.6)`, ...painel }}>{midia()}</div>
    );
  });
}

// ---------- efeitos de tratamento (no "mundo": video, fundo, elementos) ----------

export function filtroEfeitos(frame, efeitos) {
  const partes = [];
  let deslocX = 0;
  let deslocY = 0;
  for (const e of ativoEm(efeitos, frame)) {
    const k = presenca(e, frame, 7);
    if (e.tipo === 'preto_branco') partes.push(`grayscale(${k}) contrast(${1 + 0.12 * k})`);
    if (e.tipo === 'cor_quente') partes.push(`sepia(${0.28 * k}) saturate(${1 + 0.2 * k})`);
    if (e.tipo === 'cor_fria') partes.push(`hue-rotate(${12 * k}deg) saturate(${1 - 0.12 * k}) brightness(${1 + 0.03 * k})`);
    if (e.tipo === 'alto_contraste') partes.push(`contrast(${1 + 0.3 * k}) saturate(${1 + 0.2 * k})`);
    if (e.tipo === 'brilho_sonho') partes.push(`brightness(${1 + 0.08 * k}) saturate(${1 + 0.12 * k})`);
    if (e.tipo === 'tremor') {
      deslocX += (ruido(frame) - 0.5) * 18 * k;
      deslocY += (ruido(frame + 99) - 0.5) * 14 * k;
    }
    if (e.tipo === 'glitch' && ruido(Math.floor(frame / 2)) > 0.55) {
      deslocX += (ruido(frame * 3) - 0.5) * 40 * k;
      partes.push(`hue-rotate(${(ruido(frame * 7) - 0.5) * 90 * k}deg) saturate(${1 + 0.6 * k})`);
    }
  }
  return { filtro: partes.join(' '), deslocX, deslocY };
}

export function SobreposicaoEfeitos({ efeitos }) {
  const frame = useCurrentFrame();
  const u = useUnidade();
  return ativoEm(efeitos, frame).map((e, i) => {
    const k = presenca(e, frame, 7);
    if (e.tipo === 'granulado') {
      return (
        <AbsoluteFill key={i} style={{
          opacity: 0.16 * k, mixBlendMode: 'overlay',
          backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27/></filter><rect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/></svg>")',
          backgroundPosition: `${(frame * 37) % 240}px ${(frame * 53) % 240}px`,
        }} />
      );
    }
    if (e.tipo === 'vinheta_forte') return <AbsoluteFill key={i} style={{ opacity: k, background: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)' }} />;
    if (e.tipo === 'brilho_sonho') return <AbsoluteFill key={i} style={{ opacity: 0.35 * k, mixBlendMode: 'screen', background: 'radial-gradient(ellipse at 50% 30%, rgba(255,240,220,0.9), rgba(255,255,255,0) 60%)' }} />;
    if (e.tipo === 'glitch' && ruido(Math.floor(frame / 2)) > 0.55) {
      const y = ruido(frame) * 100;
      return (
        <AbsoluteFill key={i} style={{ opacity: k }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: `${6 + ruido(frame + 3) * 10}%`, background: 'rgba(255,0,80,0.18)', mixBlendMode: 'screen' }} />
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) ${2 * u}px, transparent ${2 * u}px, transparent ${5 * u}px)` }} />
        </AbsoluteFill>
      );
    }
    return null;
  });
}

// ---------- transicoes ----------

// efeito no "mundo" inteiro em volta do quadro da transicao (t < 0 = saindo, t >= 0 = entrando)
export function cameraTransicao(frame, transicoes, width) {
  let tx = 0;
  let escala = 1;
  let giro = 0;
  let borrao = 0;
  let filtro = '';
  for (const tr of transicoes) {
    const t = frame - tr.frame;
    if (t < -7 || t > 12) continue;
    if (tr.tipo === 'whip') {
      tx += t < 0 ? interpolate(t, [-6, 0], [0, -0.18 * width], { ...clamp, easing: Easing.in(Easing.cubic) }) : interpolate(t, [0, 8], [0.18 * width, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
      borrao = Math.max(borrao, interpolate(Math.abs(t), [0, 7], [22, 0], clamp));
    } else if (tr.tipo === 'zoom') {
      escala *= t < 0 ? interpolate(t, [-6, 0], [1, 1.35], { ...clamp, easing: Easing.in(Easing.cubic) }) : interpolate(t, [0, 9], [1.35, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
      borrao = Math.max(borrao, interpolate(Math.abs(t), [0, 6], [10, 0], clamp));
    } else if (tr.tipo === 'giro') {
      giro += t < 0 ? interpolate(t, [-6, 0], [0, 25], { ...clamp, easing: Easing.in(Easing.cubic) }) : interpolate(t, [0, 9], [-25, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
      escala *= interpolate(Math.abs(t), [0, 8], [1.25, 1], clamp);
      borrao = Math.max(borrao, interpolate(Math.abs(t), [0, 6], [12, 0], clamp));
    } else if (tr.tipo === 'desfoque') {
      borrao = Math.max(borrao, interpolate(t, [-7, 0, 9], [0, 16, 0], clamp));
      filtro += ` brightness(${interpolate(t, [-7, 0, 9], [1, 1.25, 1], clamp)})`;
    } else if (tr.tipo === 'glitch' && t >= -3 && t <= 6) {
      tx += (ruido(frame * 5) - 0.5) * 0.08 * width;
      filtro += ` hue-rotate(${(ruido(frame * 11) - 0.5) * 140}deg) saturate(1.8)`;
    }
  }
  return { tx, escala, giro, borrao, filtro };
}

export function SobreposicaoTransicoes({ transicoes }) {
  const frame = useCurrentFrame();
  const u = useUnidade();
  const camadas = [];
  for (const [i, tr] of transicoes.entries()) {
    const t = frame - tr.frame;
    if (t < -8 || t > 14) continue;
    if (tr.tipo === 'flash') {
      const op = interpolate(t, [-1, 0, 6], [0, 0.8, 0], clamp);
      if (op > 0) camadas.push(<AbsoluteFill key={i} style={{ background: '#fff', opacity: op }} />);
    } else if (tr.tipo === 'luz') {
      const op = interpolate(t, [-8, 0, 14], [0, 0.85, 0], clamp);
      const x = interpolate(t, [-8, 14], [-20, 120], clamp);
      camadas.push(<AbsoluteFill key={i} style={{ opacity: op, mixBlendMode: 'screen', background: `radial-gradient(ellipse at ${x}% 30%, rgba(255,170,90,0.95) 0%, rgba(255,80,140,0.55) 30%, rgba(0,0,0,0) 65%)` }} />);
    } else if (tr.tipo === 'queimado') {
      const op = interpolate(t, [-6, 0, 12], [0, 1, 0], clamp);
      const r = interpolate(t, [-6, 12], [10, 160], clamp);
      camadas.push(<AbsoluteFill key={i} style={{ opacity: op, mixBlendMode: 'screen', background: `radial-gradient(circle at 15% 85%, rgba(255,255,230,1) 0%, rgba(255,150,40,0.95) ${r * 0.25}%, rgba(200,30,0,0.6) ${r * 0.5}%, rgba(0,0,0,0) ${r}%)` }} />);
    } else if (tr.tipo === 'glitch' && t >= -3 && t <= 6) {
      camadas.push(
        <AbsoluteFill key={i}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${ruido(frame) * 90}%`, height: `${8 + ruido(frame + 1) * 12}%`, background: 'rgba(0,255,255,0.25)', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${ruido(frame + 5) * 90}%`, height: `${5 + ruido(frame + 2) * 8}%`, background: 'rgba(255,0,90,0.3)', mixBlendMode: 'screen' }} />
          <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) ${2 * u}px, transparent ${2 * u}px, transparent ${5 * u}px)` }} />
        </AbsoluteFill>,
      );
    }
  }
  return camadas;
}
