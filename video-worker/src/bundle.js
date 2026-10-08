// compila a composicao Remotion (remotion/) num pacote estatico - roda no build da imagem Docker
// ("npm run bundle") pra que o servico nao precise do webpack em tempo de execucao.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function gerarBundle(destino = path.join(RAIZ, 'bundle')) {
  return bundle({
    entryPoint: path.join(RAIZ, 'remotion', 'index.jsx'),
    publicDir: path.join(RAIZ, 'remotion', 'public'),
    outDir: destino,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const saida = await gerarBundle();
  console.log('bundle gerado em', saida);
}
