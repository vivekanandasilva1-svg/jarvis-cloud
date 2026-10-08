import React from 'react';
import { AbsoluteFill, Composition, Img, registerRoot } from 'remotion';
import { Edicao } from './Edicao.jsx';

// arte vetorial (SVG) desenhada pelo Claude -> PNG, rasterizada pelo mesmo Chrome do video (entende
// todos os filtros/gradientes que ele usa); fundo transparente quando o SVG nao desenha fundo
function Arte({ svg }) {
  const src = `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(svg || ''))) : ''}`;
  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <Img src={src} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
}

// largura/altura/duracao vem do roteiro de cada video (calculateMetadata), nao sao fixos
function Raiz() {
  return (
    <>
      <Composition
        id="Edicao"
        component={Edicao}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={30}
        defaultProps={{ videoSrc: '', segmentos: [], palavras: [], estilo: 'criador' }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, props.duracaoFrames || 30),
          width: props.largura || 1080,
          height: props.altura || 1920,
          fps: props.fps || 30,
        })}
      />
      <Composition
        id="Arte"
        component={Arte}
        fps={30}
        width={1024}
        height={1024}
        durationInFrames={1}
        defaultProps={{ svg: '' }}
        calculateMetadata={({ props }) => ({ width: props.largura || 1024, height: props.altura || 1024 })}
      />
    </>
  );
}

registerRoot(Raiz);
