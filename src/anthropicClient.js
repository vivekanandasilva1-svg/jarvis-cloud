// Cliente unico da Anthropic usado por todos os modulos (Lumia, Auto Atendimento, Follow Up, Gerador
// de Relatorios). Centralizar aqui garante que TODA chamada de IA: (1) desconta o custo real do
// saldo estimado (saldoIA.js) e (2) alimenta o alerta de creditos (alertaCreditos.js) - sem cada
// modulo ter que lembrar de fazer isso.
import Anthropic from '@anthropic-ai/sdk';
import { ehErroDeCredito, registrarFalhaCredito, creditoRestabelecido } from './alertaCreditos.js';
import { registrarUso } from './saldoIA.js';

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const criarOriginal = anthropic.messages.create.bind(anthropic.messages);
anthropic.messages.create = async (params, ...resto) => {
  try {
    const resposta = await criarOriginal(params, ...resto);
    creditoRestabelecido();
    registrarUso(params?.model, resposta?.usage); // sem await: contabilidade nunca atrasa nem derruba a resposta
    return resposta;
  } catch (err) {
    if (ehErroDeCredito(err)) registrarFalhaCredito().catch(() => {});
    throw err;
  }
};
