// Creditos da Anthropic acabaram ("Your credit balance is too low..."): a IA para de responder pra
// TODO MUNDO ao mesmo tempo (Auto Atendimento, chat da Lumia, retornos...) e so o dono consegue
// resolver (recarregar em console.anthropic.com > Plans & Billing). Este modulo:
// - reconhece esse erro especifico (ehErroDeCredito)
// - guarda em RAM que esta esgotado (creditoEsgotado) pra o sino do app e os agendadores saberem
// - avisa o dono pelo WhatsApp dele (numero admin), no maximo 1 vez a cada 3h - e uma mensagem
//   simples sem IA, entao funciona justamente quando a IA esta fora
import { pool } from './db.js';
import * as whatsappInstances from './whatsappInstances.js';
import { enviarMensagemTexto } from './evolutionApi.js';

const VALIDADE_MS = 30 * 60 * 1000; // sem nova falha por 30min = considera normalizado
const INTERVALO_AVISO_MS = 3 * 60 * 60 * 1000;
let ultimaFalha = 0;
let ultimoAviso = 0;

export function ehErroDeCredito(err) {
  const texto = `${err?.message || ''} ${JSON.stringify(err?.error || '')}`;
  return /credit balance is too low/i.test(texto);
}

export function creditoEsgotado() {
  return Date.now() - ultimaFalha < VALIDADE_MS;
}

// chamado quando uma chamada a IA deu certo - o problema acabou
export function creditoRestabelecido() {
  if (ultimaFalha) console.log('Creditos da Anthropic restabelecidos - a IA voltou a responder.');
  ultimaFalha = 0;
  ultimoAviso = 0; // se acabar de novo mais tarde, avisa de novo
}

export async function registrarFalhaCredito() {
  ultimaFalha = Date.now();
  if (Date.now() - ultimoAviso < INTERVALO_AVISO_MS || !pool) return;
  ultimoAviso = Date.now();
  try {
    const { rows } = await pool.query('SELECT id FROM tenants WHERE super_admin = true AND ativo = true');
    for (const { id } of rows) {
      const { numeroAdmin } = await whatsappInstances.obterConfig(id);
      if (!numeroAdmin) continue;
      await enviarMensagemTexto(id, numeroAdmin, '⚠️ ATENÇÃO: os créditos da Anthropic (a IA da Lumia) acabaram. Enquanto isso, o Auto Atendimento e o chat da Lumia não conseguem responder. As mensagens dos leads estão sendo guardadas e a IA responde sozinha assim que você recarregar em console.anthropic.com → Plans & Billing.');
    }
  } catch (err) {
    console.error('Erro avisando o dono sobre os creditos da Anthropic:', err.message);
  }
}
