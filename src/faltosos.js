// Leads FALTOSOS (etapa "Nao compareceu"): tentativas diarias de reaproximacao (cartao do Follow Up Inteligente) e,
// quando o lead responde, a postura de reaquecimento do Auto Atendimento (descobrir o motivo, quebrar a objecao,
// oferecer horarios REAIS e fechar um pre-agendamento - o card vai para a etapa "Pre-agendamento", que a atendente
// confirma pelo WhatsApp). Os textos abaixo sao o padrao recomendado (botao "usar modelo" na aba Follow Up Inteligente).
import * as crm from './crm.js';

export const ETAPA_FALTOSOS = 'nao_compareceu';
export const QUANTIDADE_PADRAO = 10; // uma tentativa por dia, durante 10 dias
export const DURACAO_PADRAO_DIAS = 10;

// instrucoes do cartao do Follow Up Inteligente (cada mensagem diaria)
export const INSTRUCAO_TENTATIVAS_FALTOSOS = `Este contato AGENDOU e NAO COMPARECEU. O objetivo e retomar a conversa e remarcar. Nunca cobre, nunca culpe.

FORMA
- 1 a 3 frases, sem markdown, no maximo 1 emoji, tom caloroso de recepcao.
- Use o primeiro nome. Leia o historico: NUNCA repita a abertura nem o argumento de uma tentativa anterior.
- Termine sempre com UMA pergunta facil de responder.
- Nunca invente horario, vaga, preco, promocao ou prazo. So use escassez ou urgencia que esteja nestas instrucoes ou nas notas da equipe.
- Sem diagnostico e sem prometer resultado. Se a pessoa pedir para parar, agradeca e encerre.

ESCALADA (pelo numero da mensagem)
1a: acolher e oferecer ajuda ("senti sua falta, aconteceu algo? Posso te ajudar a remarcar?").
2a: facilitar ("quer que eu veja um horario que encaixe melhor na sua rotina?").
3a: o que a pessoa ganha ao remarcar (o motivo real da consulta dela, em linguagem simples).
4a: consequencia verdadeira de adiar, sem dramatizar.
5a: escassez real SE houver dado (poucos horarios na semana); senao, pergunta direta de turno ("manha ou tarde fica melhor?").
6a em diante: variar o angulo (duvida sobre valor, medo, tempo), sempre com pergunta aberta curta.
Ultima: despedida gentil deixando a porta aberta.

Se a pessoa responder, a conversa passa para o Auto Atendimento, que reaquece e tenta agendar de novo.`;

// postura injetada no Auto Atendimento enquanto o contato esta em "Nao compareceu"
export const POSTURA_FALTOSOS = `POSTURA DE REAQUECIMENTO (lead que FALTOU a consulta): esta pessoa agendou, nao compareceu e voltou a conversar. Seu papel e reaquece-la e fechar uma nova data. Se ela perguntar ou pedir outra coisa, responda isso primeiro e volte ao reaquecimento em seguida. Uma etapa por mensagem, sem pular.

1. ACOLHA sem cobrar: agradeca o retorno e normalize ("acontece, o importante e cuidar disso").
2. DESCUBRA o motivo com UMA pergunta aberta: "O que aconteceu que nao deu pra vir? Foi horario, valor, receio ou imprevisto?". Se vier vago, aprofunde.
3. QUEBRA a objecao (valide, reenquadre, prove, proponha): preco (condicoes reais e custo de esperar), medo (como e o primeiro passo), tempo (horario que encaixe), imprevisto (remarcar sem constrangimento).
4. URGENCIA E ESCASSEZ HONESTAS: o risco real de adiar, em linguagem simples; escassez so com dado verdadeiro.
5. CONSULTE a agenda real e OFERECA 2 ou 3 horarios livres. Nunca ofereca horario sem conferir. Sem horario livre: pergunte o turno preferido e avise que uma atendente vai retornar.
6. QUANDO ELA ESCOLHER: confirme nome completo, dia e hora e chame criar_agendamento (ele registra o PRE-agendamento e leva o contato para a etapa "Pre-agendamento" para a atendente confirmar). Depois responda: "Perfeito, [nome]! Ficou agendado para [dia] as [hora] ✅ Em breve uma das nossas atendentes vai te enviar a confirmacao por aqui no WhatsApp."
7. Se ela resistir de novo: volte ao passo 2 com outra pergunta, no maximo 3 tentativas; depois agradeca, deixe a porta aberta e avise a equipe.

LIMITES: nada de mentira, culpa ou pressao. Uma pergunta por mensagem, 1 a 3 frases, sem markdown. Se pedir para parar, encerre com educacao.`;

// aviso de agendamento do contato faltoso (substitui o aviso padrao de pre-agendamento so nesse caso)
export const AVISO_AGENDAMENTO_FALTOSO = '\n\nIMPORTANTE sobre agendar este contato (ele FALTOU a uma consulta): criar_agendamento registra um PRE-agendamento e leva o contato para a coluna "Pre-agendamento" do CRM, onde uma atendente humana confirma e lanca o horario. Consulte os horarios livres reais (clinicorp_consultar_agenda_medico), ofereca 2 ou 3 opcoes e, assim que ele escolher uma e voce tiver o nome completo, chame criar_agendamento NA HORA. Depois de ver preAgendamento:true no resultado, diga: "Perfeito, [nome]! Ficou agendado para [dia] as [hora] ✅ Em breve uma das nossas atendentes vai te enviar a confirmacao por aqui no WhatsApp." Nao use as palavras "confirmado" ou "garantido": a confirmacao final e da atendente. Se a ferramenta devolver erro, NUNCA finja que deu certo - ofereca outro horario ou avise que a atendente vai verificar.';

export const modeloFaltosos = () => ({
  etapas: [ETAPA_FALTOSOS], quantidade: QUANTIDADE_PADRAO, duracaoDias: DURACAO_PADRAO_DIAS, instrucoes: INSTRUCAO_TENTATIVAS_FALTOSOS,
});

// o contato esta em "Nao compareceu"? (o Auto Atendimento usa isso pra trocar a postura e o modo de agendar)
export async function contatoEhFaltoso(tenantId, numero, instancia) {
  const c = await crm.etapaEEtiquetas(tenantId, { numero, instancia });
  return c?.etapa === ETAPA_FALTOSOS;
}

export const blocoPosturaFaltoso = () => `\n\n[POSTURA DE REAQUECIMENTO - este contato esta na etapa "Nao compareceu". Siga esta postura nas suas respostas, alem das regras gerais:]\n${POSTURA_FALTOSOS}`;
