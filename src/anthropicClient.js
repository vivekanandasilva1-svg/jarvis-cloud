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
