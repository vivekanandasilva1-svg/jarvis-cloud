// Cliente unico da Anthropic usado por todos os modulos (Lumia, Auto Atendimento, Follow Up, Gerador
// de Relatorios). Centralizar aqui garante que TODA chamada de IA: (1) desconta o custo real do
// saldo estimado (saldoIA.js) e (2) alimenta o alerta de creditos (alertaCreditos.js) - sem cada
// modulo ter que lembrar de fazer isso.
import Anthropic from '@anthropic-ai/sdk';
import { ehErroDeCredito, registrarFalhaCredito, creditoRestabelecido } from './alertaCreditos.js';
import { registrarUso } from './saldoIA.js';
import { estaAtivo } from './tenants.js';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const criarOriginal = anthropic.messages.create.bind(anthropic.messages);
// quem chama pode mandar `_uso: { tenantId, modulo }` junto dos parametros - serve so pra atribuir o
// custo ao cliente/modulo certo (saldoIA.js) e e removido aqui, nunca vai pra API
anthropic.messages.create = async (params, ...resto) => {
  const { _uso, ...corpo } = params || {};
  // cliente desativado: nenhuma chamada de IA (e nenhum gasto de credito) em nome dele
  if (_uso?.tenantId > 0 && !(await estaAtivo(_uso.tenantId))) {
    const err = new Error('conta desativada - IA bloqueada');
    err.codigo = 'CONTA_INATIVA';
    throw err;
  }
  try {
    const resposta = await criarOriginal(corpo, ...resto);
    creditoRestabelecido();
    registrarUso(corpo.model, resposta?.usage, _uso); // sem await: contabilidade nunca atrasa nem derruba a resposta
    return resposta;
  } catch (err) {
    if (ehErroDeCredito(err)) registrarFalhaCredito().catch(() => {});
    throw err;
  }
};

// ---------- outros caminhos de chamada (cobertura total do gasto) ----------
// Hoje o app so usa messages.create, mas qualquer chamada nova que alguem escreva depois (streaming
// ou a API beta) tambem precisa ser contabilizada - senao o saldo estimado deriva sem ninguem
// perceber. Mesmo contrato do create: aceita `_uso: { tenantId, modulo }` e nunca atrasa a resposta.
function contabilizarMensagemFinal(modelo, mensagem, uso) {
  if (mensagem?.usage) registrarUso(mensagem.model || modelo, mensagem.usage, uso);
}

const streamOriginal = anthropic.messages.stream.bind(anthropic.messages);
anthropic.messages.stream = (params, ...resto) => {
  const { _uso, ...corpo } = params || {};
  const stream = streamOriginal(corpo, ...resto);
  stream.finalMessage().then((m) => contabilizarMensagemFinal(corpo.model, m, _uso)).catch(() => {});
  return stream;
};

if (anthropic.beta?.messages?.create) {
  const betaCriarOriginal = anthropic.beta.messages.create.bind(anthropic.beta.messages);
  anthropic.beta.messages.create = async (params, ...resto) => {
    const { _uso, ...corpo } = params || {};
    const resposta = await betaCriarOriginal(corpo, ...resto);
    if (!corpo.stream) contabilizarMensagemFinal(corpo.model, resposta, _uso);
    return resposta;
  };
}
