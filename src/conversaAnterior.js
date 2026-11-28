// Continuidade da conversa: quando a IA do Auto Atendimento ainda nao tem memoria de um contato (conversa
// importada do WhatsApp, atendida pela equipe antes da IA ligar, ou sessao apagada), ela recebe junto o
// historico recente que ja esta no CRM - assim entende o assunto e continua de onde parou em vez de se
// apresentar como se fosse a primeira mensagem.
import { pool } from './db.js';
import * as crm from './crm.js';

const FUSO = 'America/Maceio';
const MAX_MENSAGENS = 40;
const MAX_CARACTERES = 7000;
const MAX_POR_MENSAGEM = 400;

const quando = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// todasEntradasFinais: tira TODAS as ultimas mensagens do contato (usado quando elas ja estao no historico da IA);
// senao tira so as que acabaram de chegar (ultimos 5 min) - essas a IA recebe como a mensagem atual
export async function blocoConversaAnterior(tenantId, numero, instancia, { todasEntradasFinais = false } = {}) {
  if (!pool) return '';
  const variante = crm.varianteNonoDigito(numero);
  const { rows } = await pool.query(
    `SELECT direcao, texto, criado_em FROM crm_mensagens
      WHERE tenant_id = $1 AND instancia = $2 AND numero = ANY($3::text[]) AND criado_em > now() - interval '90 days' AND COALESCE(texto, '') <> ''
      ORDER BY criado_em DESC LIMIT 80`,
    [tenantId, instancia, variante ? [numero, variante] : [numero]],
  );
  const msgs = rows.reverse(); // da mais antiga pra mais nova
  while (msgs.length && msgs[msgs.length - 1].direcao === 'entrada'
    && (todasEntradasFinais || Date.now() - new Date(msgs[msgs.length - 1].criado_em).getTime() < 5 * 60 * 1000)) msgs.pop();
  if (!msgs.length) return '';

  const linhas = [];
  let total = 0;
  for (const m of msgs.slice(-MAX_MENSAGENS).reverse()) { // da mais nova pra tras, ate estourar o limite
    const texto = String(m.texto).replace(/\s+/g, ' ').trim().slice(0, MAX_POR_MENSAGEM);
    const linha = `[${quando(m.criado_em)}] ${m.direcao === 'entrada' ? 'Contato' : 'Clinica'}: ${texto}`;
    if (total + linha.length > MAX_CARACTERES && linhas.length) break;
    total += linha.length;
    linhas.push(linha);
  }
  linhas.reverse();
  return '\n\nCONVERSA ANTERIOR COM ESSE CONTATO (aconteceu antes desta sessao - com a equipe ou com voce -, da mais antiga pra mais recente; "Clinica" = nossas mensagens):\n'
    + linhas.join('\n')
    + '\n\nCOMO USAR ISSO: continue a conversa de onde ela parou. NAO se apresente de novo, NAO repita o que ja foi dito ou oferecido e respeite o que a equipe ja combinou (horario, valor, orientacao). '
    + 'Se a pessoa retomou um assunto, responda a partir dele. Fotos, audios e documentos antigos aparecem so como [imagem], [audio], [documento]: voce sabe que existiram, mas nao ve o conteudo.';
}
