// composicao principal: monta o video final a partir do "roteiro" calculado pelo worker
// (ver src/montarRoteiro.js). Tudo aqui ja chega em FRAMES do video final - os cortes, zooms e
// sobreposicoes foram ancorados nas palavras faladas e convertidos antes de chegar aqui, entao
// nada sai de sincronia quando um trecho e cortado.
import React from 'react';
import {
  AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { obterEstilo } from './estilos.js';

// escala de layout: tudo foi desenhado pra 1080px no menor lado
const useUnidade = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

const sombraTexto = (e, u, forte = false) => {
  if (e.contorno) {
    const s = Math.round((forte ? 7 : 5) * u);
    return `0 0 ${s}px rgba(0,0,0,0.9), 0 ${s / 2}px ${s * 1.5}px rgba(0,0,0,0.75)`;
  }
  if (e.brilho) return `0 0 ${18 * u}px ${e.corDestaque}88, 0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.6)`;
  return `0 ${3 * u}px ${14 * u}px rgba(0,0,0,0.55)`;
};

// ---------- camada de video: cortes + "camera" (zoom de enfase, deriva lenta, jump-cut) ----------

function fatorZoom(frame, zooms, fps, e) {
  let fator = 1;
  for (const z of zooms) {
    const t = frame - z.frame;
    if (t < 0 || t > fps * 3.2) continue;
    if (z.tipo === 'soco') {
      const entrada = spring({ frame: t, fps, config: { damping: 14, stiffness: 180 } });
      const saida = interpolate(t, [fps * 1.4, fps * 1.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
      fator = Math.max(fator, 1 + (e.zoomSoco - 1) * entrada * (1 - saida));
    } else {
      const ida = interpolate(t, [0, fps * 2.6], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) });
      const volta = interpolate(t, [fps * 2.6, fps * 3.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
      fator = Math.max(fator, 1 + 0.1 * ida * (1 - volta));
    }
  }
  return fator;
}

function CamadaVideo({ videoSrc, segmentos, zooms, estilo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seg = segmentos.find((s) => frame >= s.outInicio && frame < s.outInicio + s.duracao) || segmentos[segmentos.length - 1];
  const progressoSeg = seg ? (frame - seg.outInicio) / Math.max(1, seg.duracao) : 0;
  // jump-cut alterna enquadramento entre segmentos (esconde o "pulo" do corte) + deriva lenta
  // dentro do segmento pra imagem nunca ficar parada
  const escala = (seg?.escala || 1) * (1 + 0.025 * progressoSeg) * fatorZoom(frame, zooms, fps, estilo);
  return (
    <AbsoluteFill style={{ transform: `scale(${escala})`, transformOrigin: '50% 38%', filter: estilo.filtroVideo }}>
      {segmentos.map((s, i) => (
        <Sequence key={i} from={s.outInicio} durationInFrames={s.duracao} layout="none">
          <OffthreadVideo
            src={videoSrc}
            trimBefore={s.srcInicioFrame}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            // micro fade de audio nas bordas do corte - evita o "clique" de cortar no meio da onda
            volume={(f) => interpolate(f, [0, 2, s.duracao - 2, s.duracao], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function Acabamento({ estilo }) {
  const frame = useCurrentFrame();
  return (
    <>
      {estilo.vinheta > 0 && (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,${estilo.vinheta}) 100%)` }} />
      )}
      {estilo.grao && (
        <AbsoluteFill style={{
          opacity: 0.09, mixBlendMode: 'overlay',
          backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27/></filter><rect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/></svg>")',
          backgroundPosition: `${(frame * 37) % 240}px ${(frame * 53) % 240}px`,
        }} />
      )}
    </>
  );
}

// ---------- legendas palavra por palavra ----------

function paginarLegendas(palavras, porTela) {
  const paginas = [];
  let atual = [];
  const fechar = () => { if (atual.length) paginas.push(atual); atual = []; };
  palavras.forEach((p, i) => {
    const anterior = palavras[i - 1];
    const pausa = anterior ? p.i - anterior.f : 0;
    const chars = atual.reduce((n, w) => n + w.t.length + 1, 0);
    if (atual.length >= porTela || pausa > 0.45 || chars + p.t.length > 18) fechar();
    atual.push(p);
    if (/[.!?…]$/.test(p.t)) fechar();
  });
  fechar();
  return paginas;
}

function Legendas({ palavras, estilo, ocultarEm, posicao }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const t = frame / fps;
  const paginas = React.useMemo(() => paginarLegendas(palavras, estilo.palavrasPorTela), [palavras, estilo.palavrasPorTela]);

  if (ocultarEm.some(([a, b]) => frame >= a && frame < b)) return null;
  const idx = paginas.findIndex((pg, k) => {
    const prox = paginas[k + 1];
    const fim = prox ? Math.min(prox[0].i, pg[pg.length - 1].f + 0.6) : pg[pg.length - 1].f + 0.6;
    return t >= pg[0].i - 0.05 && t < fim;
  });
  if (idx < 0) return null;
  const pagina = paginas[idx];
  const inicioPag = Math.round((pagina[0].i - 0.05) * fps);
  const entrada = spring({ frame: frame - inicioPag, fps, config: { damping: 13, stiffness: 220 } });
  const tamanho = (estilo.maiusculas ? 76 : 72) * u;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: height * (posicao === 'meio' ? 0.52 : 0.665), width: '84%',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${4 * u}px ${18 * u}px`,
        transform: `scale(${0.82 + 0.18 * entrada}) translateY(${(1 - entrada) * 24 * u}px)`, opacity: entrada,
        ...(estilo.fundoLegenda ? { background: estilo.fundoLegenda, padding: `${14 * u}px ${30 * u}px`, borderRadius: 26 * u, width: 'auto', maxWidth: '86%' } : {}),
      }}>
        {pagina.map((p, k) => {
          const ativa = t >= p.i && t < p.f + 0.08;
          const jaDita = t >= p.i;
          const pulso = ativa ? spring({ frame: frame - Math.round(p.i * fps), fps, config: { damping: 10, stiffness: 300 } }) : 0;
          const cor = p.d || (ativa && !estilo.fundoLegenda) ? estilo.corDestaque : estilo.corTexto;
          return (
            <span key={k} style={{
              fontFamily: estilo.fonteLegenda, fontWeight: estilo.pesoLegenda, fontSize: tamanho * (p.d ? 1.12 : 1),
              lineHeight: 1.08, color: cor, textTransform: estilo.maiusculas ? 'uppercase' : 'none',
              textShadow: sombraTexto(estilo, u), opacity: jaDita ? 1 : 0.55,
              transform: `scale(${1 + 0.1 * pulso})`, display: 'inline-block', letterSpacing: estilo.maiusculas ? 0.5 * u : 0,
            }}>{p.t}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ---------- sobreposicoes ----------

function TextoImpacto({ texto, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tamanho = Math.min(150, 1700 / Math.max(6, texto.length)) * u * (estilo.fonteTitulo === estilo.fonteLegenda && estilo.maiusculas ? 1.1 : 1);
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: height * 0.13, width: '88%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${22 * u}px`, opacity: saida }}>
        {palavras.map((p, k) => {
          const s = spring({ frame: frame - k * 3, fps, config: { damping: 12, stiffness: 170 } });
          const ultima = k === palavras.length - 1 && palavras.length > 1;
          return (
            <span key={k} style={{
              fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: tamanho, lineHeight: 1.0,
              textTransform: 'uppercase', color: ultima ? estilo.corDestaque : estilo.corTexto,
              textShadow: sombraTexto(estilo, u, true), display: 'inline-block',
              transform: `scale(${1.6 - 0.6 * s})`, opacity: s, filter: `blur(${(1 - s) * 8 * u}px)`,
            }}>{p}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function TextoTopo({ texto, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: height * 0.12, maxWidth: '84%', padding: `${18 * u}px ${34 * u}px`,
        background: 'rgba(10,10,14,0.78)', borderRadius: 22 * u, border: `${3 * u}px solid ${estilo.corDestaque}`,
        boxShadow: estilo.brilho ? `0 0 ${30 * u}px ${estilo.corDestaque}66` : `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.45)`,
        transform: `translateY(${(1 - s) * -60 * u}px)`, opacity: s * saida,
        fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: 54 * u, color: estilo.corTexto,
        textAlign: 'center', lineHeight: 1.15,
      }}>{texto}</div>
    </AbsoluteFill>
  );
}

function Etiqueta({ texto, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', top: height * 0.56, left: 60 * u, display: 'flex', alignItems: 'stretch',
        transform: `translateX(${(1 - s) * -500 * u}px)`, opacity: saida,
      }}>
        <div style={{ width: 12 * u, background: estilo.corDestaque, borderRadius: 6 * u }} />
        <div style={{
          marginLeft: 14 * u, padding: `${14 * u}px ${26 * u}px`, background: 'rgba(255,255,255,0.95)', borderRadius: 14 * u,
          fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: 44 * u, color: '#111',
        }}>{texto}</div>
      </div>
    </AbsoluteFill>
  );
}

function Numero({ valor, prefixo, sufixo, rotulo, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const progresso = interpolate(frame, [0, fps * 0.9], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const casas = Number.isInteger(valor) ? 0 : 1;
  const atual = (valor * progresso).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: height * 0.11, textAlign: 'center', opacity: s * saida, transform: `scale(${0.7 + 0.3 * s})` }}>
        <div style={{
          fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: 210 * u, lineHeight: 1,
          color: estilo.corTexto, textShadow: sombraTexto(estilo, u, true),
          ...(estilo.brilho ? { backgroundImage: `linear-gradient(180deg, #fff 30%, ${estilo.corDestaque})`, WebkitBackgroundClip: 'text', color: 'transparent', textShadow: 'none', filter: `drop-shadow(0 0 ${20 * u}px ${estilo.corDestaque}aa)` } : {}),
        }}>
          {prefixo}{atual}<span style={{ fontSize: 110 * u, color: estilo.brilho ? undefined : estilo.corDestaque }}>{sufixo}</span>
        </div>
        {rotulo && (
          <div style={{ marginTop: 10 * u, fontFamily: estilo.fonteLegenda, fontWeight: estilo.pesoLegenda, fontSize: 46 * u, color: estilo.corTexto, textShadow: sombraTexto(estilo, u), textTransform: 'uppercase', letterSpacing: 2 * u }}>{rotulo}</div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function Lista({ titulo, itens, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // itens aparecem distribuidos ao longo do tempo em que a pessoa fala da lista
  const intervalo = Math.max(6, Math.min(fps * 1.2, (duracao - fps * 0.6) / Math.max(1, itens.length)));
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: height * 0.1, width: '80%', padding: `${30 * u}px ${36 * u}px`,
        background: 'rgba(12,12,18,0.82)', borderRadius: 30 * u, border: `${2 * u}px solid rgba(255,255,255,0.12)`,
        boxShadow: estilo.brilho ? `0 0 ${40 * u}px ${estilo.corDestaque}55` : `0 ${16 * u}px ${40 * u}px rgba(0,0,0,0.5)`,
        opacity: s * saida, transform: `translateY(${(1 - s) * -40 * u}px) scale(${0.94 + 0.06 * s})`,
      }}>
        {titulo && <div style={{ fontFamily: estilo.fonteTitulo, fontWeight: estilo.pesoTitulo, fontSize: 50 * u, color: estilo.corDestaque, marginBottom: 18 * u, textTransform: 'uppercase' }}>{titulo}</div>}
        {itens.map((item, k) => {
          const si = spring({ frame: frame - fps * 0.3 - k * intervalo, fps, config: { damping: 15, stiffness: 170 } });
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 18 * u, marginTop: 14 * u, opacity: si, transform: `translateX(${(1 - si) * 60 * u}px)` }}>
              <div style={{ width: 46 * u, height: 46 * u, borderRadius: 23 * u, background: estilo.corDestaque, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: estilo.fonteTitulo, fontWeight: 900, fontSize: 28 * u, flexShrink: 0 }}>✓</div>
              <div style={{ fontFamily: estilo.fonteLegenda, fontWeight: estilo.pesoLegenda, fontSize: 42 * u, color: '#fff', lineHeight: 1.15 }}>{item}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ---------- composicao ----------

export function Edicao(props) {
  const { videoSrc, segmentos, palavras, zooms = [], textos = [], numeros = [], listas = [], sfx = [], estilo: nomeEstilo, corDestaque, legendas = true, posicaoLegenda = 'baixo' } = props;
  const estilo = obterEstilo(nomeEstilo, corDestaque);
  // a legenda some enquanto um texto grande ou lista ocupa a tela - evita poluicao visual
  const ocultarLegenda = [
    ...textos.filter((t) => t.estilo === 'impacto').map((t) => [t.inicio, t.fim]),
    ...listas.map((l) => [l.inicio, l.fim]),
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <CamadaVideo videoSrc={videoSrc} segmentos={segmentos} zooms={zooms} estilo={estilo} />
      <Acabamento estilo={estilo} />
      {textos.map((t, i) => (
        <Sequence key={`t${i}`} from={t.inicio} durationInFrames={Math.max(1, t.fim - t.inicio)}>
          {t.estilo === 'impacto' && <TextoImpacto texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} />}
          {t.estilo === 'topo' && <TextoTopo texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} />}
          {t.estilo === 'etiqueta' && <Etiqueta texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} />}
        </Sequence>
      ))}
      {numeros.map((n, i) => (
        <Sequence key={`n${i}`} from={n.inicio} durationInFrames={Math.max(1, n.fim - n.inicio)}>
          <Numero {...n} duracao={n.fim - n.inicio} estilo={estilo} />
        </Sequence>
      ))}
      {listas.map((l, i) => (
        <Sequence key={`l${i}`} from={l.inicio} durationInFrames={Math.max(1, l.fim - l.inicio)}>
          <Lista {...l} duracao={l.fim - l.inicio} estilo={estilo} />
        </Sequence>
      ))}
      {legendas && <Legendas palavras={palavras} estilo={estilo} ocultarEm={ocultarLegenda} posicao={posicaoLegenda} />}
      {sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={s.frame} durationInFrames={30} layout="none">
          <Audio src={staticFile(`sfx/${s.tipo}.wav`)} volume={s.tipo === 'whoosh' ? 0.32 : 0.4} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
