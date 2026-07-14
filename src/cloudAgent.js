import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';
import { transcribeAudio } from './gemini.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------- Memoria persistente (Postgres) ----------
// sem DATABASE_URL, roda com memoria so em RAM (perde tudo se o servidor reiniciar) - continua
// funcionando, so sem persistencia de verdade, pra nao quebrar ambientes sem banco configurado
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function garantirTabelas() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      pending_action JSONB,
      pending_local_action JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learned_instructions (
      id SERIAL PRIMARY KEY,
      texto TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
const tabelasProntas = garantirTabelas().catch((err) => {
  console.error('Erro criando tabelas no Postgres - memoria de conversa vai ficar so em RAM ate isso ser resolvido:', err.message);
});

const SYSTEM_PROMPT = `Voce e a Lumia, um superagente de inteligencia artificial de nivel senior
que opera na fusao entre Engenharia Exata, Alta Performance Humana e Marketing de Resposta
Direta. Voce e assistente pessoal do usuario (dono de uma clinica odontologica e de uma agencia
de trafego pago que tambem se chama Lumia - voce leva o mesmo nome da agencia), conversando por
uma interface de chat (texto e voz) num app web publico. Voce atua como Diretor de Crescimento
(CMO), Arquiteto de Software, Treinador Comportamental e Estrategista de Negocios - tom cirurgico,
visionario, empatico e extremamente focado em resultado tangivel, com a autoridade de um mentor
multidisciplinar.

NUCLEO DE COMPETENCIAS:
- Marketing odontologico de elite: metodologias de Ricardo Novack (conversao comercial no
  WhatsApp, scripts de venda para secretaria, quebra de objecao financeira, precificacao
  lucrativa por cadeira, meta de 100k por consultorio) e Matheus Marcondes/Smiles University
  (posicionamento premium, publico high-ticket, experiencia do paciente/overdelivering,
  construcao de marca). Trafego pago (Meta Ads, Google Ads - Pesquisa/PMax/Maps, TikTok Ads),
  funis de conversao local e estrategias de lancamento (Invisalign Day, Implante Day, lives).
- Audiovisual, copywriting e design: roteiros e copies com AIDA, PAS, storytelling e gatilhos
  mentais para pacientes de alto valor; briefings visuais (hooks nos 3s iniciais, direcao de
  cena, enquadramento, ritmo de corte, paleta institucional premium).
- Engenharia de software e ciencia da informacao: arquitetura de dados, engenharia de prompt,
  automacoes (webhooks, Make, n8n), modelagem de banco de dados, algoritmos, e como algoritmos
  de redes sociais/busca distribuem e ranqueiam conteudo.
- Maestria humana: inteligencia emocional, PNL, psicologia comportamental; erudicao em teologia
  comparada, filosofia hermetica e simbologia para decifrar arquetipos e aplicar psicologia
  profunda na comunicacao e lideranca.
- Gestao empresarial e financas: CAC, LTV, ROAS, margem de contribuicao, lucro liquido,
  estruturacao contabil/holding/blindagem patrimonial.
- Palestrante e mestra em falar em publico: oratoria, storytelling de palco, gatilhos mentais
  (escassez, autoridade, prova social, reciprocidade, urgencia), neuromarketing, PNL aplicada
  (ancoragem, rapport, calibragem de linguagem) e coaching/mentoring (perguntas poderosas,
  quebra de crenca limitante, plano de acao).

Quando o usuario pedir pra voce palestrar, ensinar, dar uma aula, apresentar algo ou falar como
se tivesse um publico assistindo (e principalmente se ele disser que tem gente vendo/ouvindo
nesse momento), assuma esse papel de verdade: fale como quem esta consciente de ser vista e
ouvida por varias pessoas ao vivo - varia o ritmo, usa pausas estrategicas, storytelling, tom de
voz. Isso vale tanto por texto quanto (principalmente) quando a resposta vai ser falada em voz
alta pelo modo conversa. Nao seja um leitor de slide - seja a palestrante de verdade, natural,
humana, energica, criando conexao com quem esta "na plateia".

Formato de resposta - adapta pelo contexto, nao usa o mesmo formato pra tudo: numa pergunta
rapida ou conversa (principalmente quando pode ser falada em voz alta pelo modo conversa),
responde curto e direto, frases corridas, sem markdown pesado (headings/tabelas soam quebrado
quando lidos em voz). Quando o pedido for claramente por um entregavel escrito - roteiro pronto
pra gravacao, analise financeira, briefing criativo, codigo/automacao, plano estrategico -
ai sim estrutura de verdade com headings (##, ###), listas e tabelas, e entrega pronto pra uso
(roteiro completo, logica exata do codigo, numeros organizados).

Sempre use as ferramentas disponiveis para agir de verdade - nunca finja ter feito algo.

Voce tem acesso ao Gerenciador de Anuncios da Meta (contas de clinicas odontologicas e outros
clientes da Lumia). Pode consultar contas, campanhas, conjuntos de anuncios, anuncios/criativos
e metricas livremente. Quando pedirem analise ou diagnostico de campanha, use
ads_diagnostico_campanha e de uma leitura profissional dos resultados (o que pausar, ajustar ou
testar), nao so liste numeros.

Ferramentas de anuncio que envolvem gastar dinheiro real (ativar campanha, mudar orcamento,
criar campanha) NAO executam na hora - elas ficam pendentes de confirmacao e o proprio sistema
vai perguntar "sim ou nao" pro usuario. So chame essas ferramentas quando o pedido do usuario ja
estiver claro o suficiente para perguntar a confirmacao (valor, campanha exatos).

Voce tambem tem acesso amplo ao sistema Clinicorp da clinica: agenda, pacientes, financeiro
detalhado (notas fiscais, recibos, fluxo de caixa, pagamentos, parcelamento medio, glosas de
convenio), relatorios comerciais (conversao de orcamentos, receita por especialidade, metas de
vendas/faltas, analitico geral), estatisticas de agenda (ocupacao, info geral), catalogo de
procedimentos e especialidades, dados organizacionais (clinicas, unidades, usuarios, cadeiras)
e extras de paciente (aniversariantes, resumo de orcamentos). O usuario ja autorizou usar tudo
isso livremente, incluindo criar/cancelar agendamentos e cadastrar pacientes, sem precisar
confirmar cada chamada - execute direto quando o pedido for claro. So avise (sem bloquear) se
for algo de volume/impacto incomum, como cancelar varios agendamentos de uma vez.

IMPORTANTE - limitacao real do Clinicorp: a API NAO da acesso a prontuario clinico (fichas,
odontograma, evolucao clinica) nem a fotos/imagens ja salvas dos pacientes - so existe um
endpoint de upload (mandar arquivo novo), nao de consulta. Se o usuario pedir prontuario ou
fotos de paciente, explique essa limitacao com clareza em vez de inventar uma resposta ou
fingir que puxou o dado.

O usuario tambem pode anexar arquivos na conversa (imagem, audio ou video) para voce analisar.
Imagens chegam para voce de verdade (analise visual direta). Audio chega como uma transcricao
de fala para texto (voce nao ouve tom de voz, so o conteudo falado). Video chega como alguns
quadros/imagens extraidos dele (voce ve cenas do video, mas nao ouve o audio do video nem ve
ele por completo). Se a analise depender de algo que essas limitacoes deixam de fora, avise o
usuario em vez de supor.

Voce tambem pode controlar o computador do usuario: abrir/fechar programas, abrir/ler/criar/
editar/apagar arquivos (ferramentas pc_*). Isso SO funciona quando o usuario esta com o app
aberto no proprio computador rodando o agente local - se o agente nao estiver conectado, a
ferramenta volta com um erro explicando isso, informe o usuario com clareza nesse caso (nao
insista tentando de novo). Por seguranca, so consegue mexer em arquivos dentro da pasta pessoal
do usuario (Documentos, Desktop, Downloads etc) - nunca em pastas de sistema, e isso e reforcado
no proprio agente local, entao nem tente contornar. Fechar programa, sobrescrever arquivo
existente e apagar arquivo/pasta pedem confirmacao do usuario antes de executar (o sistema
cuida disso sozinho quando voce chama a ferramenta - so chame quando o pedido ja estiver claro
o suficiente pra perguntar a confirmacao). NAO existe ferramenta para instalar ou baixar
softwares novos - se pedirem isso, explique que voce so consegue abrir/fechar programas ja
instalados e mexer em arquivos, nao instalar nada novo (por seguranca).

Voce tambem consegue ver os favoritos salvos no navegador do usuario (pc_listar_favoritos, com
pastas e subpastas) e pode abrir qualquer um deles com pc_abrir_app passando a URL. Abas abertas
AGORA no Chrome (pc_listar_abas_navegador) so funcionam se o usuario tiver aberto o Chrome com
depuracao remota ligada - se der erro nessa ferramenta, explique que precisa fechar todo o
Chrome e abrir de novo com a flag --remote-debugging-port=9222, em vez de insistir tentando de
novo sozinho.

Voce tambem consegue enxergar pela camera do dispositivo do usuario, usando ver_camera - ela liga
a camera (se estiver desligada) e captura uma imagem do que esta sendo filmado. Use sempre que o
usuario pedir pra voce ver/olhar/abrir os olhos pela camera, em qualquer formato (texto, audio ou
modo conversa). Depois de ver a imagem, comente de forma natural o que voce enxergou.

Memoria: voce NUNCA esquece uma conversa sozinha - todo o historico fica salvo de verdade (nao
so na memoria do navegador), sobrevivendo a fechar o app, atualizar a pagina ou o servidor
reiniciar. So apaga quando o usuario pedir EXPLICITAMENTE (ferramenta esquecer_conversa) ou
clicar no botao "Limpar" - nunca por conta propria, nem quando o assunto mudar.

Voce tambem pode ser treinada: quando o usuario pedir explicitamente pra voce aprender/lembrar
algo sobre como se comportar dali em diante (nao so nesta conversa, mas em qualquer conversa
futura), use a ferramenta aprender_instrucao. Essas instrucoes aparecem nesse mesmo prompt, numa
secao "INSTRUCOES QUE O USUARIO JA TE ENSINOU" (se houver) - trate como parte permanente de quem
voce e. Se o usuario pedir pra esquecer o que te ensinou, use esquecer_instrucoes_aprendidas.`;

// devolve o system prompt em dois blocos, nao uma string so - isso e o que permite prompt
// caching de verdade. O SYSTEM_PROMPT (grande, quase nunca muda) fica marcado com
// cache_control: a Anthropic guarda ele por uns minutos e cobra soh ~10% do preco normal nas
// chamadas seguintes que reusarem o mesmo prefixo - e a MESMA resposta, mesmo modelo, so mais
// barato. A data de hoje e as instrucoes aprendidas (que mudam) ficam num segundo bloco, sem
// cache, depois do ponto de corte - assim elas nao "quebram" o cache do bloco grande de cima.
async function systemPromptBlocos() {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  let dinamico = `A data de hoje e ${hoje} (fuso horario de Maceio/Brasil). Use isso para calcular "hoje", "ontem", "essa semana" etc sem precisar perguntar ao usuario.`;

  const instrucoes = await listarInstrucoesAprendidas();
  if (instrucoes.length) {
    dinamico += `\n\nINSTRUCOES QUE O USUARIO JA TE ENSINOU (siga todas, valem permanentemente ate ele pedir pra esquecer):\n${instrucoes.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`;
  }

  return [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dinamico },
  ];
}

const tools = [
  {
    name: 'ads_listar_contas',
    description: 'Lista todas as contas de anuncio da Meta (Facebook/Instagram Ads) que o usuario gerencia, com nome, id e cliente.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ads_listar_campanhas',
    description: 'Lista as campanhas de uma conta de anuncio especifica.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Id da conta de anuncio (ex: act_123456 ou so 123456)' },
        status: { type: 'string', description: 'Filtrar por status (ex: ACTIVE, PAUSED)' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'ads_listar_adsets',
    description: 'Lista os conjuntos de anuncios (ad sets) de uma campanha, com orcamento e status.',
    input_schema: {
      type: 'object',
      properties: { campaignId: { type: 'string', description: 'Id da campanha' } },
      required: ['campaignId'],
    },
  },
  {
    name: 'ads_consultar_metricas',
    description: 'Consulta metricas de performance (gasto, impressoes, cliques, resultados) de uma conta, campanha, conjunto de anuncios ou anuncio individual.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Id do objeto (conta, campanha, ad set ou anuncio)' },
        objectType: { type: 'string', description: '"account", "campaign", "adset" ou "ad"' },
        since: { type: 'string', description: 'Data inicial YYYY-MM-DD (opcional)' },
        until: { type: 'string', description: 'Data final YYYY-MM-DD (opcional)' },
        datePreset: { type: 'string', description: 'Ex: today, yesterday, last_7d, last_30d' },
      },
      required: ['objectId', 'objectType'],
    },
  },
  {
    name: 'ads_listar_anuncios',
    description: 'Lista os anuncios (nivel criativo: titulo, texto, miniatura) dentro de um conjunto de anuncios.',
    input_schema: {
      type: 'object',
      properties: { adSetId: { type: 'string', description: 'Id do conjunto de anuncios' } },
      required: ['adSetId'],
    },
  },
  {
    name: 'ads_diagnostico_campanha',
    description: 'Analise comparativa de performance entre os anuncios de uma campanha - calcula a media do grupo e aponta quais anuncios estao performando pior e por que. Use para pedidos de analise/diagnostico/melhoria.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Id da campanha' },
        since: { type: 'string', description: 'Data inicial YYYY-MM-DD (opcional)' },
        until: { type: 'string', description: 'Data final YYYY-MM-DD (opcional)' },
        datePreset: { type: 'string', description: 'Ex: today, yesterday, last_7d, last_30d' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'ads_criar_campanha',
    description: 'Pede para criar uma campanha nova (sempre em PAUSED - nao gasta ate ter conjunto de anuncios e ser ativada). Fica pendente de confirmacao.',
    input_schema: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Id da conta de anuncio' },
        name: { type: 'string', description: 'Nome da campanha' },
        objective: { type: 'string', description: 'Objetivo (ex: OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT)' },
      },
      required: ['accountId', 'name', 'objective'],
    },
  },
  {
    name: 'ads_alterar_status_campanha',
    description: 'Pede para ativar, pausar ou arquivar uma campanha. Fica pendente de confirmacao, pois ativar gasta dinheiro real.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Id da campanha' },
        status: { type: 'string', description: 'ACTIVE, PAUSED ou ARCHIVED' },
      },
      required: ['campaignId', 'status'],
    },
  },
  {
    name: 'ads_alterar_orcamento_adset',
    description: 'Pede para mudar o orcamento diario de um conjunto de anuncios. Fica pendente de confirmacao.',
    input_schema: {
      type: 'object',
      properties: {
        adSetId: { type: 'string', description: 'Id do conjunto de anuncios' },
        dailyBudgetReais: { type: 'number', description: 'Novo orcamento diario em reais' },
      },
      required: ['adSetId', 'dailyBudgetReais'],
    },
  },
  {
    name: 'clinicorp_listar_profissionais',
    description: 'Lista os profissionais/dentistas cadastrados na clinica.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'clinicorp_listar_agendamentos',
    description: 'Lista os agendamentos da clinica num periodo (agenda geral, ou de um paciente/profissional especifico).',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        patientId: { type: 'integer', description: 'Filtrar por id de paciente (opcional)' },
        includeCanceled: { type: 'boolean', description: 'Incluir agendamentos cancelados (default false)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'clinicorp_buscar_paciente',
    description: 'Busca um paciente existente pelo telefone, nome, CPF ou email.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Telefone ou celular do paciente' },
        name: { type: 'string', description: 'Nome do paciente' },
        document: { type: 'string', description: 'CPF do paciente' },
        email: { type: 'string', description: 'Email do paciente' },
      },
    },
  },
  {
    name: 'clinicorp_criar_paciente',
    description: 'Cria um novo paciente no sistema da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome completo do paciente' },
        mobilePhone: { type: 'string', description: 'Celular do paciente' },
        email: { type: 'string', description: 'Email do paciente' },
        birthDate: { type: 'string', description: 'Data de nascimento YYYY-MM-DD' },
        document: { type: 'string', description: 'CPF do paciente' },
      },
      required: ['name'],
    },
  },
  {
    name: 'clinicorp_criar_agendamento',
    description: 'Cria um novo agendamento na agenda da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        patientId: { type: 'integer', description: 'Id do paciente, se ja conhecido' },
        patientName: { type: 'string', description: 'Nome do paciente' },
        mobilePhone: { type: 'string', description: 'Telefone de contato' },
        email: { type: 'string', description: 'Email de contato' },
        date: { type: 'string', description: 'Data YYYY-MM-DD' },
        fromTime: { type: 'string', description: 'Horario de inicio HH:mm' },
        toTime: { type: 'string', description: 'Horario de termino HH:mm' },
        procedures: { type: 'string', description: 'Procedimentos, ex: Limpeza, Consulta' },
      },
      required: ['patientName', 'date', 'fromTime', 'toTime'],
    },
  },
  {
    name: 'clinicorp_cancelar_agendamento',
    description: 'Cancela um agendamento existente pelo id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id do agendamento a cancelar' } },
      required: ['id'],
    },
  },
  {
    name: 'clinicorp_faturamento',
    description: 'Consulta o resumo financeiro da clinica (vendas, recebido, despesas) num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'clinicorp_procedimentos',
    description: 'Consulta o catalogo de procedimentos (tabela de precos) ou a lista de especialidades da clinica. Use "busca" para filtrar procedimentos por nome.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"lista" (procedimentos) ou "especialidades"' },
        busca: { type: 'string', description: 'Filtro por nome do procedimento (opcional, so vale para tipo=lista)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_relatorio_financeiro',
    description: 'Relatorios financeiros detalhados da clinica: notas fiscais, recibos, fluxo de caixa, pagamentos, parcelamento medio ou glosas de convenio.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Um de: notas_fiscais, recibos, fluxo_caixa, pagamentos_financeiro, parcelamento_medio, pagamentos, glosas_convenio',
        },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes (so vale para parcelamento_medio)' },
        statusGlosa: { type: 'string', description: 'Para tipo=glosas_convenio: ALL, OPEN, DISPUTE, REJECT, PARTIAL_PAID ou PAID' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_relatorio_comercial',
    description: 'Relatorios comerciais/de metas: conversao de orcamentos, receita por especialidade, metas de vendas, metas de faltas ou analitico geral.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Um de: conversao_orcamentos, receita_especialidade, metas_vendas, metas_faltas, analitico_geral',
        },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes (conversao_orcamentos)' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_agenda_estatisticas',
    description: 'Estatisticas da agenda: informacoes gerais (total de agendamentos, faltas) ou ocupacao da agenda (%) num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"info_geral" ou "ocupacao"' },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD' },
        groupByMonth: { type: 'boolean', description: 'Agrupar por mes' },
      },
      required: ['tipo', 'from', 'to'],
    },
  },
  {
    name: 'clinicorp_organizacao',
    description: 'Informacoes organizacionais: clinicas do assinante, unidades da franquia, usuarios do sistema ou cadeiras da clinica.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'Um de: clinicas_assinante, unidades_franquia, usuarios, cadeiras' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_paciente_extra',
    description: 'Aniversariantes do dia ou resumo/soma de orcamentos dos pacientes num periodo.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: '"aniversariantes" ou "resumo_orcamentos"' },
        date: { type: 'string', description: 'Data YYYY-MM-DD (para aniversariantes, default hoje)' },
        from: { type: 'string', description: 'Data inicial YYYY-MM-DD (para resumo_orcamentos)' },
        to: { type: 'string', description: 'Data final YYYY-MM-DD (para resumo_orcamentos)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clinicorp_orcamento_detalhe',
    description: 'Detalhe completo de um orcamento especifico pelo id do tratamento.',
    input_schema: {
      type: 'object',
      properties: { treatmentId: { type: 'integer', description: 'Id do tratamento/orcamento' } },
      required: ['treatmentId'],
    },
  },
  // ---------- Controle do computador do usuario ----------
  // essas ferramentas NAO executam no servidor - so funcionam quando o usuario esta com a
  // aba da Lumia aberta no PRORIO computador, rodando o agente local (nao exposto pra
  // internet). O navegador do usuario e quem de fato chama o agente local; o servidor so
  // decide qual acao pedir e se ela precisa de confirmacao antes.
  {
    name: 'pc_abrir_app',
    description: 'Abre um programa (ex: "notepad", "calc", "chrome", ou caminho completo de um .exe) OU um site (URL). Pra abrir um site, manda SO a URL (ex: "https://www.google.com") - nunca junte nome de navegador com a URL no mesmo texto, o navegador padrao do usuario abre sozinho.',
    input_schema: {
      type: 'object',
      properties: { nome: { type: 'string', description: 'Nome/caminho do programa, OU uma URL comecando com http:// ou https:// pra abrir um site' } },
      required: ['nome'],
    },
  },
  {
    name: 'pc_fechar_app',
    description: 'Fecha um programa que esta rodando no computador do usuario (perde trabalho nao salvo - fica pendente de confirmacao).',
    input_schema: {
      type: 'object',
      properties: { nome: { type: 'string', description: 'Nome do processo/programa a fechar (ex: "notepad", "chrome")' } },
      required: ['nome'],
    },
  },
  {
    name: 'pc_abrir_arquivo',
    description: 'Abre um arquivo no computador do usuario com o programa padrao dele (so dentro da pasta pessoal do usuario).',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho do arquivo, relativo a pasta do usuario (ex: "Desktop\\relatorio.pdf")' } },
      required: ['caminho'],
    },
  },
  {
    name: 'pc_ler_arquivo',
    description: 'Le o conteudo de texto de um arquivo no computador do usuario (so dentro da pasta pessoal).',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho do arquivo, relativo a pasta do usuario' } },
      required: ['caminho'],
    },
  },
  {
    name: 'pc_listar_pasta',
    description: 'Lista os arquivos e subpastas de uma pasta no computador do usuario (so dentro da pasta pessoal).',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho da pasta, relativo a pasta do usuario (vazio = raiz da pasta do usuario)' } },
    },
  },
  {
    name: 'pc_criar_arquivo',
    description: 'Cria um arquivo NOVO (nunca sobrescreve um que ja existe) no computador do usuario, com o conteudo de texto dado.',
    input_schema: {
      type: 'object',
      properties: {
        caminho: { type: 'string', description: 'Caminho do novo arquivo, relativo a pasta do usuario' },
        conteudo: { type: 'string', description: 'Conteudo de texto do arquivo' },
      },
      required: ['caminho', 'conteudo'],
    },
  },
  {
    name: 'pc_editar_arquivo',
    description: 'Sobrescreve o conteudo de um arquivo JA EXISTENTE no computador do usuario. Fica pendente de confirmacao, pois apaga o conteudo anterior.',
    input_schema: {
      type: 'object',
      properties: {
        caminho: { type: 'string', description: 'Caminho do arquivo existente, relativo a pasta do usuario' },
        conteudo: { type: 'string', description: 'Novo conteudo de texto completo do arquivo' },
      },
      required: ['caminho', 'conteudo'],
    },
  },
  {
    name: 'pc_apagar_arquivo',
    description: 'Apaga um arquivo ou pasta no computador do usuario. Fica pendente de confirmacao - acao irreversivel.',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string', description: 'Caminho do arquivo/pasta a apagar, relativo a pasta do usuario' } },
      required: ['caminho'],
    },
  },
  {
    name: 'pc_listar_favoritos',
    description: 'Lista os favoritos (bookmarks) salvos no Chrome e/ou Edge do usuario, com pastas e subpastas.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'pc_listar_abas_navegador',
    description: 'Lista as abas abertas AGORA no Chrome do usuario (titulo e URL de cada uma). So funciona se o usuario tiver aberto o Chrome com depuracao remota ligada - se der erro, explique que precisa disso.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ver_camera',
    description: 'Liga a camera do dispositivo do usuario (se estiver desligada) e captura uma imagem do que esta sendo filmado agora, pra voce enxergar e comentar. Use quando o usuario pedir pra voce "ver", "olhar", "abrir os olhos" pela camera - frases como "Lumia abra os olhos", "veja isso aqui", "veja quem esta aqui", "olha o que eu tô segurando" etc, seja por texto, audio ou no modo conversa. Precisa de permissao de camera do navegador - se o usuario negar, explique isso.',
    input_schema: { type: 'object', properties: {} },
  },
  // ---------- Memoria da conversa e treinamento ----------
  {
    name: 'esquecer_conversa',
    description: 'Apaga o historico desta conversa (fica tudo salvo na nuvem ate isso ser chamado, mesmo fechando o app ou atualizando a pagina). So use quando o usuario pedir EXPLICITAMENTE pra esquecer/apagar a conversa - nunca por conta propria.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aprender_instrucao',
    description: 'Guarda permanentemente uma instrucao sobre como voce deve se comportar dali em diante (o usuario "te ensinando/treinando") - fica valendo em toda conversa futura, ate ser apagada. Use quando o usuario pedir explicitamente pra voce aprender/lembrar/mudar algo no seu jeito de agir.',
    input_schema: {
      type: 'object',
      properties: { instrucao: { type: 'string', description: 'A instrucao/comportamento a guardar, escrita de forma clara e reutilizavel' } },
      required: ['instrucao'],
    },
  },
  {
    name: 'esquecer_instrucoes_aprendidas',
    description: 'Apaga TODAS as instrucoes de comportamento que o usuario ja te ensinou (reseta o treinamento, nao mexe no historico da conversa). So use quando pedido explicitamente.',
    input_schema: { type: 'object', properties: {} },
    // marca o fim do bloco de ferramentas como ponto de cache - a lista inteira (~30
    // ferramentas) e grande e quase nunca muda, entao cache_control aqui faz a Anthropic
    // cobrar bem mais barato nela nas chamadas seguintes dentro da janela de cache
    cache_control: { type: 'ephemeral' },
  },
];

const CONFIRM_TOOLS = new Set(['ads_criar_campanha', 'ads_alterar_status_campanha', 'ads_alterar_orcamento_adset']);

function describePendingAction(name, input) {
  switch (name) {
    case 'ads_criar_campanha':
      return `criar a campanha "${input.name}" (objetivo ${input.objective}) na conta ${input.accountId} - ela nasce pausada, nao gasta nada ainda`;
    case 'ads_alterar_status_campanha':
      return `mudar o status da campanha ${input.campaignId} para ${input.status}${input.status === 'ACTIVE' ? ' - isso passa a gastar dinheiro real' : ''}`;
    case 'ads_alterar_orcamento_adset':
      return `mudar o orcamento diario do conjunto ${input.adSetId} para R$${input.dailyBudgetReais}/dia`;
    default:
      return JSON.stringify(input);
  }
}

async function executeConfirmedAction(name, input) {
  switch (name) {
    case 'ads_criar_campanha':
      return metaAds.createCampaign(input);
    case 'ads_alterar_status_campanha':
      return metaAds.updateCampaignStatus(input);
    case 'ads_alterar_orcamento_adset':
      return metaAds.updateAdSetBudget({ adSetId: input.adSetId, dailyBudgetCents: Math.round(input.dailyBudgetReais * 100) });
    default:
      throw new Error(`Acao desconhecida: ${name}`);
  }
}

// ---------- Controle do computador do usuario ----------
// nunca executam no servidor - o navegador do usuario que chama o agente local (127.0.0.1,
// so acessivel na propria maquina). O servidor so decide qual acao pedir e se precisa de
// confirmacao antes (mesma logica de "pendente" ja usada pros gastos de anuncio).
const PC_TOOLS = new Set([
  'pc_abrir_app', 'pc_fechar_app', 'pc_abrir_arquivo', 'pc_ler_arquivo',
  'pc_listar_pasta', 'pc_criar_arquivo', 'pc_editar_arquivo', 'pc_apagar_arquivo',
  'pc_listar_favoritos', 'pc_listar_abas_navegador', 'ver_camera',
]);
// so pedem confirmacao as que perdem trabalho nao salvo ou sao dificeis/impossiveis de
// desfazer - abrir, ler, listar e criar (nunca sobrescreve) rodam direto
const PC_CONFIRM_TOOLS = new Set(['pc_fechar_app', 'pc_editar_arquivo', 'pc_apagar_arquivo']);

function describePcAction(name, input) {
  switch (name) {
    case 'pc_fechar_app':
      return `fechar o programa "${input.nome}" (qualquer trabalho nao salvo nele sera perdido)`;
    case 'pc_editar_arquivo':
      return `sobrescrever o conteudo do arquivo "${input.caminho}"`;
    case 'pc_apagar_arquivo':
      return `apagar "${input.caminho}" - nao da pra desfazer`;
    default:
      return JSON.stringify(input);
  }
}

// corta listas grandes antes de mandar pro modelo (payload cru do Clinicorp pode ter
// dezenas de campos internos por item e passar facil de 100-300KB, o que estoura o limite
// de tokens da resposta e trava a Lumia)
function resumirLista(arr, campos, limite = 40) {
  if (!Array.isArray(arr)) return arr;
  const total = arr.length;
  const amostra = arr.slice(0, limite).map((item) => {
    const obj = {};
    for (const c of campos) obj[c] = item[c];
    return obj;
  });
  const resultado = { total, itens: amostra };
  if (total > limite) resultado.obs = `mostrando os primeiros ${limite} de ${total} - peca um periodo menor para ver tudo`;
  return resultado;
}

function resumirProcedimentos(dadosPorTabela, busca) {
  const todos = [];
  for (const tabela of Object.keys(dadosPorTabela || {})) {
    for (const p of dadosPorTabela[tabela] || []) {
      todos.push({ nome: p.ProcedureName, especialidade: p.ProcedureExpertiseName, tabela: p.PriceListName || tabela, id: p.id });
    }
  }
  let filtrados = todos;
  if (busca) {
    const termo = busca.toLowerCase();
    filtrados = todos.filter((p) => p.nome && p.nome.toLowerCase().includes(termo));
  }
  return { totalGeral: todos.length, totalEncontrado: filtrados.length, itens: filtrados.slice(0, 40) };
}

async function handleClinicorpProcedimentos({ tipo, busca }) {
  if (tipo === 'especialidades') return clinicorp.listSpecialties();
  const dados = await clinicorp.listProcedures();
  return resumirProcedimentos(dados, busca);
}

async function handleClinicorpFinanceiro({ tipo, from, to, groupByMonth, statusGlosa }) {
  switch (tipo) {
    case 'notas_fiscais':
      return resumirLista(await clinicorp.listInvoices({ from, to }), ['PatientName', 'Amount', 'Status', 'Date']);
    case 'recibos':
      return resumirLista(await clinicorp.listReceipts({ from, to }), ['PatientName', 'Amount', 'Description', 'Date']);
    case 'fluxo_caixa':
      return clinicorp.listCashFlow({ from, to });
    case 'pagamentos_financeiro':
      return resumirLista(await clinicorp.listFinancialPayments({ from, to }), ['PatientName', 'Amount', 'Type', 'Date']);
    case 'parcelamento_medio':
      return clinicorp.getAverageInstallments({ from, to, groupByMonth });
    case 'pagamentos':
      return resumirLista(
        await clinicorp.listPayments({ from, to }),
        ['PatientId', 'Amount', 'Type', 'PaymentDate', 'CheckOutDate', 'InstallmentNumber', 'InstallmentsCount', 'Canceled'],
      );
    case 'glosas_convenio':
      return resumirLista(
        await clinicorp.listPaymentReconcileClaim({ from, to, type: statusGlosa || 'ALL' }),
        ['PatientName', 'Amount', 'Status', 'Date'],
      );
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpComercial({ tipo, from, to, groupByMonth }) {
  switch (tipo) {
    case 'conversao_orcamentos':
      return clinicorp.getSalesConversion({ from, to, groupByMonth });
    case 'receita_especialidade':
      return clinicorp.getExpertiseRevenue({ from, to });
    case 'metas_vendas':
      return clinicorp.listSalesGoals({ from, to });
    case 'metas_faltas':
      return clinicorp.listMissesGoals({ from, to });
    case 'analitico_geral':
      return clinicorp.getAnalyticsResults({ from, to });
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpAgenda({ tipo, from, to, groupByMonth }) {
  if (tipo === 'ocupacao') return clinicorp.getScheduleOccupation({ from, to, groupByMonth });
  return clinicorp.getAppointmentInfo({ from, to, groupByMonth });
}

async function handleClinicorpOrganizacao({ tipo }) {
  switch (tipo) {
    case 'clinicas_assinante':
      return clinicorp.listSubscribersClinics();
    case 'unidades_franquia':
      return clinicorp.listSubscribers();
    case 'usuarios':
      return clinicorp.listUsers();
    case 'cadeiras':
      return clinicorp.listChairs();
    default:
      return { erro: `tipo desconhecido: ${tipo}` };
  }
}

async function handleClinicorpPacienteExtra({ tipo, date, from, to }) {
  if (tipo === 'aniversariantes') return clinicorp.getPatientBirthdays({ date });
  return clinicorp.getPatientEstimatesSum({ from, to });
}

const toolHandlers = {
  ads_listar_contas: () => metaAds.listAdAccounts(),
  ads_listar_campanhas: ({ accountId, status }) => metaAds.listCampaigns({ accountId, status }),
  ads_listar_adsets: ({ campaignId }) => metaAds.listAdSets({ campaignId }),
  ads_consultar_metricas: ({ objectId, objectType, since, until, datePreset }) => metaAds.getInsights({ objectId, objectType, since, until, datePreset }),
  ads_listar_anuncios: ({ adSetId }) => metaAds.listAds({ adSetId }),
  ads_diagnostico_campanha: ({ campaignId, since, until, datePreset }) => metaAds.analyzeCampaignAds({ campaignId, since, until, datePreset }),
  clinicorp_listar_profissionais: () => clinicorp.listProfessionals(),
  clinicorp_listar_agendamentos: async ({ from, to, patientId, includeCanceled }) => {
    const appointments = await clinicorp.listAppointments({
      from, to, patientId, includeCanceled: includeCanceled ? 'X' : undefined,
    });
    // a API devolve registros enormes (notas longas, dezenas de campos internos) - resume
    // antes de mandar pro modelo, senao estoura o limite de tokens da resposta
    return {
      total: appointments.length,
      agendamentos: appointments.map((a) => ({
        id: a.id,
        paciente: a.PatientName,
        telefone: a.MobilePhone,
        de: a.fromTime,
        ate: a.toTime,
        dentistaId: a.Dentist_PersonId,
        statusId: a.StatusId,
        categoria: a.CategoryDescription,
        cancelado: a.Canceled === 'X',
        motivoCancelamento: a.Canceled === 'X' ? a.CancelReason : undefined,
      })),
    };
  },
  clinicorp_buscar_paciente: ({ phone, name, document, email }) => clinicorp.findPatient({ phone, name, document, email }),
  clinicorp_criar_paciente: ({ name, mobilePhone, email, birthDate, document }) =>
    clinicorp.createPatient({ name, mobilePhone, email, birthDate, otherDocumentId: document }),
  clinicorp_criar_agendamento: (input) => clinicorp.createAppointment(input),
  clinicorp_cancelar_agendamento: ({ id }) => clinicorp.cancelAppointment({ id }),
  clinicorp_faturamento: async ({ from, to }) => {
    const resumo = await clinicorp.getFinancialSummary({ from, to });
    // so os totais - o detalhamento linha a linha e enorme e nao cabe no limite de tokens
    return {
      de: resumo.From,
      ate: resumo.To,
      totalVendas: resumo.TotalSales,
      totalRecebido: resumo.TotalIncome,
      totalDespesas: resumo.TotalExpenses,
    };
  },
  clinicorp_procedimentos: handleClinicorpProcedimentos,
  clinicorp_relatorio_financeiro: handleClinicorpFinanceiro,
  clinicorp_relatorio_comercial: handleClinicorpComercial,
  clinicorp_agenda_estatisticas: handleClinicorpAgenda,
  clinicorp_organizacao: handleClinicorpOrganizacao,
  clinicorp_paciente_extra: handleClinicorpPacienteExtra,
  clinicorp_orcamento_detalhe: ({ treatmentId }) => clinicorp.getEstimateDetail({ treatmentId }),
};

async function runTool(name, input, session, sessionId) {
  if (name === 'esquecer_conversa') {
    await limparSessao(sessionId);
    session.history = [];
    session.pendingAction = null;
    session.pendingLocalAction = null;
    return { ___esqueceuTudo: true };
  }
  if (name === 'aprender_instrucao') {
    try {
      await salvarInstrucaoAprendida(input.instrucao);
      return { ok: true, mensagem: 'Instrucao guardada - vai valer em toda conversa futura, ate ser apagada.' };
    } catch (err) {
      return { erro: err.message };
    }
  }
  if (name === 'esquecer_instrucoes_aprendidas') {
    try {
      await esquecerInstrucoesAprendidas();
      return { ok: true, mensagem: 'Todas as instrucoes que voce me ensinou foram apagadas.' };
    } catch (err) {
      return { erro: err.message };
    }
  }

  if (CONFIRM_TOOLS.has(name)) {
    session.pendingAction = { name, input };
    return {
      status: 'aguardando_confirmacao',
      mensagem: `Preciso da sua confirmacao para ${describePendingAction(name, input)}. Responda "sim" ou "nao".`,
    };
  }

  // ferramentas de PC que precisam de confirmacao (fechar app, sobrescrever, apagar) resolvem
  // o tool_use JA (com um status "aguardando confirmacao"), exatamente como as de anuncio
  // acima - a API da Anthropic exige um tool_result logo em seguida a todo tool_use, entao
  // nao da pra deixar isso pendurado esperando o usuario responder "sim"/"nao" depois. Quando
  // o usuario confirmar, a execucao de verdade (no computador) acontece como um pedido novo,
  // sem tentar reaproveitar esse tool_use ja fechado.
  if (PC_CONFIRM_TOOLS.has(name)) {
    session.pendingLocalAction = { tool: name, input, toolUseId: null };
    return {
      status: 'aguardando_confirmacao',
      mensagem: `Preciso da sua confirmacao para ${describePcAction(name, input)}. Responda "sim" ou "nao".`,
    };
  }

  const handler = toolHandlers[name];
  if (!handler) return { erro: `Ferramenta desconhecida: ${name}` };
  try {
    return await handler(input);
  } catch (err) {
    return { erro: err.message };
  }
}

const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Monta o content da mensagem do usuario misturando texto com anexos: imagens e quadros de
// video viram blocos de imagem de verdade pro Claude "ver"; audio e transcrito (fala -> texto)
// e entra como texto na propria mensagem.
async function buildUserContent(userMessage, attachments) {
  const images = [];
  let transcricoes = '';

  for (const att of attachments || []) {
    if (!att || !att.base64) continue;

    if (att.kind === 'image' || att.kind === 'video_frame') {
      const mediaType = IMAGE_MEDIA_TYPES.has(att.mediaType) ? att.mediaType : 'image/jpeg';
      images.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: att.base64 } });
    } else if (att.kind === 'audio') {
      try {
        const buffer = Buffer.from(att.base64, 'base64');
        const texto = await transcribeAudio(buffer, att.mediaType || 'audio/mpeg');
        transcricoes += `\n\n[Audio enviado pelo usuario - transcricao]: "${texto || '(sem fala reconhecida)'}"`;
      } catch (err) {
        transcricoes += `\n\n[Audio enviado pelo usuario - falha ao transcrever: ${err.message}]`;
      }
    }
  }

  let texto = (userMessage || '').trim();
  if (transcricoes) texto = (texto ? `${texto}\n` : '') + transcricoes.trim();
  if (!texto && images.length) texto = 'O usuario enviou arquivo(s) para voce analisar - veja as imagens anexadas.';

  if (!images.length) return texto;
  const content = [];
  if (texto) content.push({ type: 'text', text: texto });
  content.push(...images);
  return content;
}

// Depois que a Lumia ja respondeu usando uma imagem, troca o bloco de imagem no historico por
// um marcador leve - senao o binario da imagem seria reenviado (e recobrado) em todo turno
// seguinte da mesma sessao. A analise em texto que a Lumia deu ja fica registrada na resposta.
function apagarImagensAntigas(history) {
  for (const turn of history) {
    if (Array.isArray(turn.content)) {
      turn.content = turn.content.map((b) => {
        if (b.type === 'image') return { type: 'text', text: '[imagem enviada anteriormente pelo usuario, ja analisada]' };
        // imagem da camera veio dentro de um tool_result (ver_camera) - limpa tambem, senao
        // fica sendo reenviada (e recobrada) pra sempre nas chamadas seguintes
        if (b.type === 'tool_result' && Array.isArray(b.content) && b.content.some((c) => c.type === 'image')) {
          return { ...b, content: '[imagem capturada pela camera, ja analisada]' };
        }
        return b;
      });
    }
  }
}

function extractText(response) {
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

async function callClaude(history) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    system: await systemPromptBlocos(),
    tools,
    messages: history,
  });
  // log leve pra confirmar que o prompt caching esta funcionando de verdade -
  // cache_read_input_tokens alto (vs input_tokens baixo) significa que a maior parte do
  // prompt (system + tools) veio do cache, bem mais barato
  const u = response.usage;
  console.log(`[Claude usage] input=${u.input_tokens} output=${u.output_tokens} cache_criado=${u.cache_creation_input_tokens || 0} cache_lido=${u.cache_read_input_tokens || 0}`);
  return response;
}

// cache em RAM por cima do Postgres - evita ir no banco a cada mensagem da mesma conversa
// (que normalmente acontecem em sequencia rapida); a fonte da verdade e sempre o Postgres,
// isso aqui e so um acelerador que se reconstroi sozinho se o processo reiniciar
const sessionsCache = new Map();

async function getSession(sessionId) {
  if (sessionsCache.has(sessionId)) return sessionsCache.get(sessionId);

  let session = { history: [], pendingAction: null, pendingLocalAction: null };
  await tabelasProntas;
  if (pool) {
    try {
      const { rows } = await pool.query(
        'SELECT history, pending_action, pending_local_action FROM sessions WHERE session_id = $1',
        [sessionId],
      );
      if (rows.length) {
        session = {
          history: rows[0].history || [],
          pendingAction: rows[0].pending_action,
          pendingLocalAction: rows[0].pending_local_action,
        };
      }
    } catch (err) {
      console.error('Erro carregando sessao do Postgres, comecando conversa nova em RAM:', err.message);
    }
  }
  sessionsCache.set(sessionId, session);
  return session;
}

async function salvarSessao(sessionId, session) {
  sessionsCache.set(sessionId, session);
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO sessions (session_id, history, pending_action, pending_local_action, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, now())
       ON CONFLICT (session_id) DO UPDATE
       SET history = $2::jsonb, pending_action = $3::jsonb, pending_local_action = $4::jsonb, updated_at = now()`,
      [
        sessionId,
        JSON.stringify(session.history),
        session.pendingAction ? JSON.stringify(session.pendingAction) : null,
        session.pendingLocalAction ? JSON.stringify(session.pendingLocalAction) : null,
      ],
    );
  } catch (err) {
    console.error('Erro salvando sessao no Postgres (conversa continua funcionando so em RAM por agora):', err.message);
  }
}

// apaga o historico da conversa (botao "Limpar" ou pedido explicito do usuario) - mantem a
// sessao existindo, so zera o que ela lembra ate agora
async function limparSessao(sessionId) {
  sessionsCache.delete(sessionId);
  if (!pool) return;
  try {
    await pool.query('DELETE FROM sessions WHERE session_id = $1', [sessionId]);
  } catch (err) {
    console.error('Erro apagando sessao no Postgres:', err.message);
  }
}

async function salvarInstrucaoAprendida(texto) {
  if (!pool) return;
  await tabelasProntas;
  await pool.query('INSERT INTO learned_instructions (texto) VALUES ($1)', [texto]);
}

async function listarInstrucoesAprendidas() {
  if (!pool) return [];
  await tabelasProntas;
  try {
    const { rows } = await pool.query('SELECT texto FROM learned_instructions ORDER BY criado_em ASC');
    return rows.map((r) => r.texto);
  } catch (err) {
    console.error('Erro lendo instrucoes aprendidas do Postgres:', err.message);
    return [];
  }
}

async function esquecerInstrucoesAprendidas() {
  if (!pool) return;
  await pool.query('DELETE FROM learned_instructions');
}

export async function limparConversa(sessionId) {
  await limparSessao(sessionId);
}

const MAX_TOOL_ROUNDS = 10;
const MAX_HISTORY = 40;

function aparaHistorico(session) {
  if (session.history.length > MAX_HISTORY) {
    session.history.splice(0, session.history.length - MAX_HISTORY);
  }
  apagarImagensAntigas(session.history);
}

// roda (ou retoma) o loop de ferramentas ate a Claude parar de pedir ferramenta. Pausa e
// devolve cedo em dois casos: uma ferramenta real (ads_* ou pc_* que precisa de confirmacao)
// ja resolve o tool_use na hora (com um status "aguardando confirmacao", igual sempre foi
// pro fluxo de anuncio) e devolve o texto perguntando "sim ou nao"; uma ferramenta pc_* que
// NAO precisa de confirmacao pausa sem resolver o tool_use - so devolve pro chamador o que
// precisa rodar no navegador do usuario, que reporta o resultado depois via continuarAcaoLocal.
async function rodarLoopDeFerramentas(session, sessionId) {
  let response = await callClaude(session.history);
  let rounds = 0;

  while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
    session.history.push({ role: 'assistant', content: response.content });
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

    // so as ferramentas pc_* que NAO exigem confirmacao pausam sem resolver o tool_use - as
    // que exigem confirmacao passam pelo runTool() normal, que ja resolve na hora
    const blocoPc = toolUseBlocks.find((b) => PC_TOOLS.has(b.name) && !PC_CONFIRM_TOOLS.has(b.name));
    if (blocoPc) {
      session.pendingLocalAction = { toolUseId: blocoPc.id, tool: blocoPc.name, input: blocoPc.input };
      return { localAction: { tool: blocoPc.name, input: blocoPc.input } };
    }

    const toolResults = [];
    let esqueceuTudo = false;
    for (const block of toolUseBlocks) {
      const result = await runTool(block.name, block.input, session, sessionId);
      if (result && result.___esqueceuTudo) { esqueceuTudo = true; continue; }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }
    // esqueceu tudo: o historico ja foi zerado dentro do runTool - nao da pra continuar o
    // loop normal (nao sobrou historico nem tool_use pra fechar), entao encerra aqui direto
    if (esqueceuTudo) {
      return { texto: 'Prontinho, apaguei todo o historico dessa conversa - a proxima mensagem comeca do zero.' };
    }
    session.history.push({ role: 'user', content: toolResults });

    response = await callClaude(session.history);
    rounds += 1;

    if (session.pendingAction || session.pendingLocalAction) break;
  }

  const replyText = extractText(response) || 'Consegui os dados mas nao terminei de formular a resposta - pode perguntar de novo, talvez de forma mais especifica (ex: um periodo menor)?';
  session.history.push({ role: 'assistant', content: replyText });
  aparaHistorico(session);
  return { texto: replyText };
}

async function processarChat(session, sessionId, userMessage, attachments) {
  // pendingLocalAction com toolUseId=null so acontece depois que uma ferramenta pc_* que
  // precisa de confirmacao ja foi resolvida (status aguardando_confirmacao) - agora so falta
  // saber se o usuario confirma ou nao, exatamente como o fluxo de anuncio abaixo
  if (session.pendingLocalAction && session.pendingLocalAction.toolUseId === null) {
    const { tool, input } = session.pendingLocalAction;
    const positivo = /^\s*s(im)?\b/i.test(userMessage);
    const negativo = /^\s*n(ã|a)?o?\b/i.test(userMessage);

    if (positivo) {
      session.history.push({ role: 'user', content: userMessage });
      return { reply: null, localAction: { tool, input } };
    }

    if (negativo) {
      session.pendingLocalAction = null;
      const msg = 'Ok, cancelado.';
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({ role: 'assistant', content: msg });
      return { reply: msg };
    }

    session.pendingLocalAction = null; // nem sim nem nao - desiste da pendencia e segue como mensagem normal
  }

  if (session.pendingAction) {
    const { name, input } = session.pendingAction;
    const positivo = /^\s*s(im)?\b/i.test(userMessage);
    const negativo = /^\s*n(ã|a)?o?\b/i.test(userMessage);

    if (positivo) {
      session.pendingAction = null;
      let resultado;
      try {
        resultado = await executeConfirmedAction(name, input);
      } catch (err) {
        resultado = { erro: err.message };
      }
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({
        role: 'user',
        content: `[Sistema] A acao foi confirmada pelo usuario e executada. Resultado: ${JSON.stringify(resultado)}. Informe o usuario do resultado de forma natural.`,
      });
      const response = await callClaude(session.history);
      const replyText = extractText(response);
      session.history.push({ role: 'assistant', content: replyText });
      return { reply: replyText };
    }

    if (negativo) {
      session.pendingAction = null;
      const msg = 'Ok, cancelado.';
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({ role: 'assistant', content: msg });
      return { reply: msg };
    }

    session.pendingAction = null;
  }

  // se algo falhar daqui pra frente (ex: imagem invalida rejeitada pela Claude), desfaz tudo
  // que foi empurrado nesta chamada - senao a sessao fica com um turno quebrado no historico
  // e toda mensagem seguinte volta a falhar do mesmo jeito, pra sempre.
  const tamanhoAntes = session.history.length;
  try {
    const content = await buildUserContent(userMessage, attachments);
    session.history.push({ role: 'user', content });
    const resultado = await rodarLoopDeFerramentas(session, sessionId);
    return resultado.localAction ? { reply: null, localAction: resultado.localAction } : { reply: resultado.texto };
  } catch (err) {
    session.history.splice(tamanhoAntes);
    throw err;
  }
}

// ponto de entrada publico: carrega a sessao do Postgres (ou RAM se nao tiver banco), processa
// o turno, e salva o resultado antes de devolver - qualquer que seja o caminho que
// processarChat tomou, a sessao sempre fica persistida no fim
export async function chat(sessionId, userMessage, attachments = []) {
  const session = await getSession(sessionId);
  const resultado = await processarChat(session, sessionId, userMessage, attachments);
  await salvarSessao(sessionId, session);
  return resultado;
}

// chamado quando o navegador ja rodou a acao no computador do usuario e esta devolvendo o
// resultado - continua a mesma conversa exatamente de onde a Claude parou de esperar
export async function continuarAcaoLocal(sessionId, resultado) {
  const session = await getSession(sessionId);
  if (!session.pendingLocalAction) throw new Error('Nao ha nenhuma acao local pendente nessa sessao.');

  const { toolUseId, tool } = session.pendingLocalAction;
  session.pendingLocalAction = null;

  if (toolUseId) {
    // ver_camera devolve a imagem capturada no navegador (base64) - manda como bloco de
    // imagem de verdade no tool_result, pra Claude enxergar, em vez de JSON.stringify (que
    // so viraria um texto gigante inutil pra ela "ver")
    if (tool === 'ver_camera' && resultado && resultado.imagemBase64) {
      session.history.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: resultado.mediaType || 'image/jpeg', data: resultado.imagemBase64 },
          }],
        }],
      });
    } else {
      // veio de uma ferramenta que nao precisou de confirmacao - o tool_use ainda esta aberto,
      // fecha ele com o resultado de verdade
      session.history.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(resultado) }],
      });
    }
  } else {
    // veio do fluxo de confirmacao - o tool_use original ja tinha sido resolvido antes (como
    // "aguardando_confirmacao"), entao so reporta o resultado real como texto de sistema,
    // igual o fluxo de anuncio confirmado faz
    session.history.push({
      role: 'user',
      content: `[Sistema] A acao no computador do usuario foi executada. Resultado: ${JSON.stringify(resultado)}. Informe o usuario do resultado de forma natural.`,
    });
  }

  const tamanhoAntes = session.history.length;
  try {
    const r = await rodarLoopDeFerramentas(session, sessionId);
    const saida = r.localAction ? { reply: null, localAction: r.localAction } : { reply: r.texto };
    await salvarSessao(sessionId, session);
    return saida;
  } catch (err) {
    session.history.splice(tamanhoAntes);
    await salvarSessao(sessionId, session);
    throw err;
  }
}
