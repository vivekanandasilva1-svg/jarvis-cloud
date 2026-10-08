// composicao principal: monta o video final a partir do "roteiro" calculado pelo worker
// (ver src/montarRoteiro.js). Tudo aqui ja chega em FRAMES do video final - os cortes, zooms e
// sobreposicoes foram ancorados nas palavras faladas e convertidos antes de chegar aqui, entao
// nada sai de sincronia quando um trecho e cortado.
import React from 'react';
import {
  AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { obterEstilo } from './estilos.js';
import {
  useUnidade, sombraTexto, CamadaVideo, Fundos, Elementos, Texto3D, TextosAtras, Divisoes, desfoqueBase, filtroEfeitos,
  SobreposicaoEfeitos, cameraTransicao, SobreposicaoTransicoes,
} from './camadas.jsx';

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

function TextoImpacto({ texto, duracao, estilo, media }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const palavras = texto.split(/\s+/).filter(Boolean);
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tamanho = Math.min(150, 1700 / Math.max(6, texto.length)) * u * (estilo.fonteTitulo === estilo.fonteLegenda && estilo.maiusculas ? 1.1 : 1);
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: height * (media ? 0.42 : 0.13), width: '88%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${22 * u}px`, opacity: saida }}>
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

function TextoTopo({ texto, duracao, estilo, media }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  const saida = interpolate(frame, [duracao - 8, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: height * (media ? 0.44 : 0.12), maxWidth: '84%', padding: `${18 * u}px ${34 * u}px`,
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

function Numero({ valor, prefixo, sufixo, rotulo, duracao, estilo, media }) {
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
      <div style={{ position: 'absolute', top: height * (media ? 0.38 : 0.11), textAlign: 'center', opacity: s * saida, transform: `scale(${0.7 + 0.3 * s})` }}>
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

function Lista({ titulo, itens, duracao, estilo, media }) {
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
        position: 'absolute', top: height * (media ? 0.36 : 0.1), width: '80%', padding: `${30 * u}px ${36 * u}px`,
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

// ---------- midias de apoio, flash de transicao e trilha ----------

function Insercao({ src, kind, modo, duracao, estilo }) {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useUnidade();
  const entrada = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const saida = interpolate(frame, [duracao - 6, duracao], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kenBurns = interpolate(frame, [0, duracao], [1, 1.08]);
  const midia = kind === 'video'
    ? <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kenBurns})` }} />;
  if (modo === 'janela') {
    return (
      <AbsoluteFill style={{ alignItems: 'center' }}>
        <div style={{
          position: 'absolute', top: height * 0.08, width: '84%', aspectRatio: '16 / 11', borderRadius: 30 * u, overflow: 'hidden',
          border: `${4 * u}px solid rgba(255,255,255,0.9)`,
          boxShadow: estilo.brilho ? `0 0 ${40 * u}px ${estilo.corDestaque}88` : `0 ${18 * u}px ${50 * u}px rgba(0,0,0,0.55)`,
          transform: `translateY(${(1 - entrada) * -80 * u}px) scale(${0.9 + 0.1 * entrada}) rotate(${(1 - entrada) * -3}deg)`,
          opacity: entrada * saida,
        }}>{midia}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, entrada * 1.4) * saida, transform: `scale(${1.12 - 0.12 * entrada})` }}>
      {midia}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
}

function Trilha({ src, falas }) {
  const { fps, durationInFrames } = useVideoConfig();
  const volume = (f) => {
    const t = f / fps;
    let dist = Infinity;
    for (const [a, b] of falas) {
      if (t >= a && t <= b) { dist = 0; break; }
      dist = Math.min(dist, t < a ? a - t : t - b);
      if (a > t + 1) break;
    }
    const falando = interpolate(dist, [0, 0.35], [1, 0], { extrapolateRight: 'clamp' });
    const base = 0.3 - 0.2 * falando;
    const bordas = interpolate(f, [0, fps, durationInFrames - fps * 1.5, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return base * bordas;
  };
  return <Audio src={src} loop volume={volume} />;
}

// ---------- composicao ----------
// ordem de profundidade (de tras pra frente):
//   video base (desfocavel) > fundo novo > elementos/texto ATRAS > pessoa recortada > elementos da
//   frente > tela dividida > insercoes > efeitos/transicoes > textos, numeros, listas > legenda

export function Edicao(props) {
  const {
    videoSrc, segmentos, palavras, zooms = [], textos = [], numeros = [], listas = [], sfx = [], insercoes = [], transicoes = [],
    trilha = null, estiloCustom = null, estilo: nomeEstilo, corDestaque, legendas = true, posicaoLegenda = 'baixo', alturaTextos = 'alta',
    textosAtras = [], elementos = [], fundos = [], divisoes = [], efeitos = [], pessoaSrc = null, trechosPessoa = [],
  } = props;
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const media = alturaTextos === 'media';
  const estilo = obterEstilo(nomeEstilo, corDestaque, estiloCustom);
  const temPessoa = !!pessoaSrc && trechosPessoa.length > 0;

  // sem recorte (falhou ou nao foi preciso): o que seria "atras" vai pra frente e fundo novo nao entra
  const elementosAtras = temPessoa ? elementos.filter((e) => e.camada === 'atras') : [];
  const elementosFrente = temPessoa ? elementos.filter((e) => e.camada !== 'atras') : elementos;
  const fundosUsados = temPessoa ? fundos : [];
  const efeitosUsados = temPessoa ? efeitos : efeitos.filter((e) => e.tipo !== 'desfoque_fundo');

  const desfoque = desfoqueBase(frame, fundosUsados, efeitosUsados);
  const fx = filtroEfeitos(frame, efeitosUsados);
  const tr = cameraTransicao(frame, transicoes, width);
  const filtroMundo = `${fx.filtro} ${tr.filtro}${tr.borrao ? ` blur(${tr.borrao}px)` : ''}`.trim();

  // a legenda some enquanto um texto grande ou lista ocupa a tela - evita poluicao visual
  const ocultarLegenda = [
    ...textos.filter((t) => t.estilo === 'impacto' || t.estilo === '3d').map((t) => [t.inicio, t.fim]),
    ...listas.map((l) => [l.inicio, l.fim]),
  ];
  const videoPessoaJanela = <CamadaVideo src={videoSrc} segmentos={segmentos} zooms={[]} estilo={estilo} mudo />;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{
        transform: `translate(${tr.tx + fx.deslocX}px, ${fx.deslocY}px) scale(${tr.escala}) rotate(${tr.giro}deg)`,
        filter: filtroMundo || undefined,
      }}>
        <CamadaVideo src={videoSrc} segmentos={segmentos} zooms={zooms} estilo={estilo} filtro={desfoque ? `blur(${desfoque}px) brightness(0.85)` : ''} />
        <Fundos fundos={fundosUsados} estilo={estilo} />
        <Elementos elementos={elementosAtras} />
        {temPessoa && <TextosAtras textos={textosAtras} estilo={estilo} />}
        {temPessoa && <CamadaVideo src={pessoaSrc} segmentos={segmentos} zooms={zooms} estilo={estilo} transparente mudo trechos={trechosPessoa} />}
        <Elementos elementos={elementosFrente} />
        <Divisoes divisoes={divisoes} estilo={estilo} videoPessoa={videoPessoaJanela} />
        {insercoes.map((x, i) => (
          <Sequence key={`m${i}`} from={x.inicio} durationInFrames={Math.max(1, x.fim - x.inicio)}>
            <Insercao {...x} duracao={x.fim - x.inicio} estilo={estilo} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <Acabamento estilo={estilo} />
      <SobreposicaoEfeitos efeitos={efeitosUsados} />
      <SobreposicaoTransicoes transicoes={transicoes} />
      {!temPessoa && <TextosAtras textos={textosAtras} estilo={estilo} />}
      {textos.map((t, i) => (
        <Sequence key={`t${i}`} from={t.inicio} durationInFrames={Math.max(1, t.fim - t.inicio)}>
          {t.estilo === 'impacto' && <TextoImpacto texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} media={media} />}
          {t.estilo === '3d' && <Texto3D texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} media={media} />}
          {t.estilo === 'topo' && <TextoTopo texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} media={media} />}
          {t.estilo === 'etiqueta' && <Etiqueta texto={t.texto} duracao={t.fim - t.inicio} estilo={estilo} />}
        </Sequence>
      ))}
      {numeros.map((n, i) => (
        <Sequence key={`n${i}`} from={n.inicio} durationInFrames={Math.max(1, n.fim - n.inicio)}>
          <Numero {...n} duracao={n.fim - n.inicio} estilo={estilo} media={media} />
        </Sequence>
      ))}
      {listas.map((l, i) => (
        <Sequence key={`l${i}`} from={l.inicio} durationInFrames={Math.max(1, l.fim - l.inicio)}>
          <Lista {...l} duracao={l.fim - l.inicio} estilo={estilo} media={media} />
        </Sequence>
      ))}
      {legendas && <Legendas palavras={palavras} estilo={estilo} ocultarEm={ocultarLegenda} posicao={posicaoLegenda} />}
      {trilha && <Trilha src={trilha.src} falas={trilha.falas} />}
      {sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={s.frame} durationInFrames={30} layout="none">
          <Audio src={staticFile(`sfx/${s.tipo}.wav`)} volume={s.tipo === 'whoosh' ? 0.32 : 0.4} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
