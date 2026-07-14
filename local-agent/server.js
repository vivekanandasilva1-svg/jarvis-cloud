// Agente local da Lumia - roda SO no seu computador, escuta SO em 127.0.0.1 (nunca acessivel
// pela internet, nem pela rede local). O chat da Lumia (hospedado na nuvem) nunca fala com
// esse agente diretamente - quem fala com ele e o SEU PROPRIO NAVEGADOR, quando voce esta
// com a aba da Lumia aberta neste computador. Por isso o controle so funciona enquanto voce
// esta na maquina de verdade, mesmo que a senha do site vaze pra alguem de fora.
import express from 'express';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const execAsync = promisify(exec);
const PORT = 5391;
const TOKEN_FILE = path.join(os.homedir(), '.lumia-agent-token');

// gera um token novo no primeiro uso e guarda na pasta do usuario - so quem tem esse token
// (colado manualmente na tela da Lumia) consegue mandar comando pra esse agente
async function obterOuCriarToken() {
  try {
    return (await fs.readFile(TOKEN_FILE, 'utf8')).trim();
  } catch {
    const token = crypto.randomBytes(24).toString('hex');
    await fs.writeFile(TOKEN_FILE, token, 'utf8');
    return token;
  }
}

// so permite mexer em arquivos dentro da pasta do usuario (Documentos, Desktop, Downloads
// etc por baixo de C:\Users\voce\...) - bloqueia caminhos do sistema (C:\Windows,
// C:\Program Files\...) mesmo que a IA peca, pra um pedido malicioso ou mal-entendido nao
// conseguir mexer em nada que possa quebrar o computador de verdade
const RAIZ_PERMITIDA = os.homedir();
function caminhoSeguro(caminhoPedido) {
  const resolvido = path.resolve(RAIZ_PERMITIDA, caminhoPedido);
  if (!resolvido.startsWith(RAIZ_PERMITIDA)) {
    throw new Error(`Por seguranca, so posso mexer em arquivos dentro de ${RAIZ_PERMITIDA} - esse caminho fica fora dai.`);
  }
  return resolvido;
}

async function iniciar() {
  const token = await obterOuCriarToken();
  console.log('========================================');
  console.log('Agente local da Lumia rodando.');
  console.log(`Token de acesso: ${token}`);
  console.log('Cole esse token na tela da Lumia (icone de computador) pra autorizar.');
  console.log('========================================');

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // CORS travado so pro dominio da Lumia - sem isso, QUALQUER site que voce visitasse
  // poderia tentar mandar comando escondido pra esse agente (ataque classico contra
  // servicos locais). So esses dois dominios (produção e o dev local) podem chamar.
  const ORIGENS_PERMITIDAS = new Set([
    'https://lumia-marketing.com',
    'http://localhost:4000',
  ]);
  app.use((req, res, next) => {
    const origin = req.header('origin');
    if (origin && ORIGENS_PERMITIDAS.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use((req, res, next) => {
    if (req.header('x-agent-token') !== token) return res.status(401).json({ erro: 'token invalido' });
    next();
  });

  app.post('/abrir-app', async (req, res) => {
    let { nome } = req.body || {};
    if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
    // a IA as vezes manda "chrome https://site.com" junto (tentando "abrir o chrome nesse
    // site") - isso nao e um programa valido pro Windows achar. Se tiver uma URL no meio do
    // texto, abre so ela - o "start" do Windows ja joga URL pro navegador padrao sozinho,
    // sem precisar (nem poder) especificar qual navegador usar.
    const matchUrl = nome.match(/https?:\/\/\S+/i);
    if (matchUrl) nome = matchUrl[0];
    try {
      await execAsync(`start "" "${nome}"`, { shell: 'cmd.exe' });
      res.json({ ok: true, mensagem: `Abri "${nome}".` });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/fechar-app', async (req, res) => {
    const { nome } = req.body || {};
    if (!nome) return res.status(400).json({ erro: 'nome obrigatorio' });
    try {
      const processo = nome.toLowerCase().endsWith('.exe') ? nome : `${nome}.exe`;
      await execAsync(`taskkill /IM "${processo}" /F`);
      res.json({ ok: true, mensagem: `Fechei "${nome}".` });
    } catch (err) {
      res.status(500).json({ erro: `Nao consegui fechar "${nome}": ${err.message}` });
    }
  });

  app.post('/abrir-arquivo', async (req, res) => {
    const { caminho } = req.body || {};
    if (!caminho) return res.status(400).json({ erro: 'caminho obrigatorio' });
    try {
      const alvo = caminhoSeguro(caminho);
      await execAsync(`start "" "${alvo}"`, { shell: 'cmd.exe' });
      res.json({ ok: true, mensagem: `Abri o arquivo ${alvo}.` });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/ler-arquivo', async (req, res) => {
    const { caminho } = req.body || {};
    if (!caminho) return res.status(400).json({ erro: 'caminho obrigatorio' });
    try {
      const alvo = caminhoSeguro(caminho);
      const conteudo = await fs.readFile(alvo, 'utf8');
      res.json({ ok: true, conteudo: conteudo.slice(0, 50000) });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/listar-pasta', async (req, res) => {
    const { caminho } = req.body || {};
    try {
      const alvo = caminhoSeguro(caminho || '.');
      const itens = await fs.readdir(alvo, { withFileTypes: true });
      res.json({
        ok: true,
        itens: itens.map((i) => ({ nome: i.name, tipo: i.isDirectory() ? 'pasta' : 'arquivo' })),
      });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/criar-arquivo', async (req, res) => {
    const { caminho, conteudo } = req.body || {};
    if (!caminho) return res.status(400).json({ erro: 'caminho obrigatorio' });
    try {
      const alvo = caminhoSeguro(caminho);
      // "criar" nunca sobrescreve - se ja existir, tem que passar por editar-arquivo (que
      // exige confirmacao do usuario no chat antes de chegar aqui)
      try {
        await fs.access(alvo);
        return res.status(409).json({ erro: 'Esse arquivo ja existe - use editar em vez de criar.' });
      } catch { /* nao existe, pode criar */ }
      await fs.mkdir(path.dirname(alvo), { recursive: true });
      await fs.writeFile(alvo, conteudo || '', 'utf8');
      res.json({ ok: true, mensagem: `Criei o arquivo ${alvo}.` });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/editar-arquivo', async (req, res) => {
    const { caminho, conteudo } = req.body || {};
    if (!caminho || conteudo === undefined) return res.status(400).json({ erro: 'caminho e conteudo obrigatorios' });
    try {
      const alvo = caminhoSeguro(caminho);
      await fs.writeFile(alvo, conteudo, 'utf8');
      res.json({ ok: true, mensagem: `Salvei as alteracoes em ${alvo}.` });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.post('/apagar-arquivo', async (req, res) => {
    const { caminho } = req.body || {};
    if (!caminho) return res.status(400).json({ erro: 'caminho obrigatorio' });
    try {
      const alvo = caminhoSeguro(caminho);
      await fs.rm(alvo, { recursive: true });
      res.json({ ok: true, mensagem: `Apaguei ${alvo}.` });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  // le o arquivo de favoritos direto do perfil do navegador (Chrome/Edge guardam num JSON
  // dentro da pasta do usuario) - so leitura, nao precisa de nenhuma configuracao extra
  app.post('/favoritos', async (req, res) => {
    const local = process.env.LOCALAPPDATA;
    if (!local) return res.status(500).json({ erro: 'LOCALAPPDATA nao encontrado (so funciona no Windows)' });

    const candidatos = [
      { navegador: 'Chrome', caminho: path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks') },
      { navegador: 'Edge', caminho: path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks') },
    ];

    function achatar(node) {
      if (node.type === 'url') return [{ tipo: 'favorito', nome: node.name, url: node.url }];
      if (node.type === 'folder') {
        const filhos = (node.children || []).flatMap(achatar);
        return [{ tipo: 'pasta', nome: node.name, itens: filhos }];
      }
      return [];
    }

    const resultado = [];
    for (const { navegador, caminho } of candidatos) {
      try {
        const bruto = JSON.parse(await fs.readFile(caminho, 'utf8'));
        const raizes = Object.values(bruto.roots || {}).filter((r) => r && typeof r === 'object' && r.children);
        resultado.push({ navegador, pastas: raizes.flatMap(achatar) });
      } catch { /* navegador nao instalado ou sem favoritos - so pula */ }
    }

    if (!resultado.length) return res.status(404).json({ erro: 'Nao encontrei favoritos do Chrome nem do Edge neste computador.' });
    res.json({ ok: true, navegadores: resultado });
  });

  // abas abertas AGORA, em tempo real - exige o Chrome rodando com depuracao remota ligada
  // (--remote-debugging-port=9222), pois nao existe API padrao pra "espiar" abas de um
  // navegador comum sem isso ou uma extensao instalada
  app.post('/abas', async (req, res) => {
    try {
      const controlador = new AbortController();
      const timer = setTimeout(() => controlador.abort(), 3000);
      const resp = await fetch('http://localhost:9222/json', { signal: controlador.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`Chrome DevTools respondeu ${resp.status}`);
      const alvos = await resp.json();
      const abas = alvos
        .filter((a) => a.type === 'page')
        .map((a) => ({ titulo: a.title, url: a.url }));
      res.json({ ok: true, abas });
    } catch {
      res.status(503).json({
        erro: 'Nao consegui ver as abas abertas - o Chrome precisa estar rodando com depuracao remota ligada. Feche todo o Chrome e abra de novo com o atalho/comando que tem a flag --remote-debugging-port=9222.',
      });
    }
  });

  app.get('/ping', (req, res) => res.json({ ok: true }));

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Escutando em http://127.0.0.1:${PORT} (so local, nao acessivel de fora)`);
  });
}

iniciar();
