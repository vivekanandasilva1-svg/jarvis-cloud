import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Edicao } from './Edicao.jsx';

// largura/altura/duracao vem do roteiro de cada video (calculateMetadata), nao sao fixos
function Raiz() {
  return (
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
  );
}

registerRoot(Raiz);
