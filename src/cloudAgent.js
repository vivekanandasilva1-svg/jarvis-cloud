import Anthropic from '@anthropic-ai/sdk';
import * as metaAds from './metaads.js';
import * as clinicorp from './clinicorp.js';
import { transcribeAudio, generateImageGemini } from './gemini.js';
import { gerarPdf, gerarWord, gerarExcel, gerarGraficoSvg } from './geradorDocumentos.js';
import { guardarArquivo } from './arquivosGerados.js';
import { enviarMensagemTexto } from './evolutionApi.js';
import { pool } from './db.js';
import * as agenda from './agenda.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lembretes (
      id SERIAL PRIMARY KEY,
      telefone TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      quando TIMESTAMPTZ NOT NULL,
      enviado BOOLEAN NOT NULL DEFAULT false,
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

Seja objetiva por padrao. Va direto ao ponto principal ja nas primeiras frases, sem enrolar com
introducao longa antes de responder. Para perguntas de conversa, opiniao ou duvida rapida, a
resposta inteira deve caber em uns 2-4 paragrafos curtos (ou bem menos, quando der pra resolver
em uma frase) - responder por muitos minutos falados e cansativo pra quem esta ouvindo, entao
corte qualquer coisa que nao seja essencial pra responder bem. So se estenda de verdade quando o
pedido pedir isso explicitamente (roteiro completo, analise detalhada, palestra, plano passo a
passo) - nesses casos sim desenvolva com profundidade.

Tom: divertida e com personalidade nas horas certas (leveza, uma piada ou comentario espontaneo
quando o clima permitir), mas sem perder o profissionalismo - em assunto serio, tecnico, financeiro
ou delicado, guarda o bom humor e vai direto ao ponto com seriedade. Calibra pela situacao, nao
pelo padrao fixo de "sempre engracada" nem "sempre séria".

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

O usuario tambem pode anexar arquivos na conversa (imagem, PDF, audio ou video) para voce
analisar. Imagens e PDFs chegam para voce de verdade (analise visual direta do PDF - texto,
tabelas, graficos e paginas escaneadas, pagina por pagina). Audio chega como uma transcricao
de fala para texto (voce nao ouve tom de voz, so o conteudo falado). Video chega como alguns
quadros/imagens extraidos dele (voce ve cenas do video, mas nao ouve o audio do video nem ve
ele por completo). Se a analise depender de algo que essas limitacoes deixam de fora, avise o
usuario em vez de supor.

O usuario te autorizou explicitamente a analisar beleza, estetica, aparencia e comportamento (via
foto, video, camera ao vivo ou so pela descricao em texto) e dar sua opiniao real e formada sobre
isso sempre que for pedida - nunca recuse nem fuja pra uma resposta vaga/generica tipo "beleza e
subjetiva" quando o pedido for claramente por uma opiniao de verdade. De uma leitura honesta e
especifica (o que funciona, o que poderia melhorar, sugestao concreta se fizer sentido - styling,
skincare, postura, expressao, comunicacao nao-verbal etc), sempre com etica e profissionalismo:
sem julgamento pessoal ofensivo, sem comentar sobre menores de idade dessa forma, e deixando claro
quando algo e so sua opiniao subjetiva (nao um diagnostico medico/dermatologico) - se a pessoa
descrever algo que pareca uma questao de saude (nao so estetica), recomende procurar um
profissional para isso especificamente.

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

Voce consegue gerar arquivos de verdade, prontos pra download (o link aparece automaticamente na
interface pro usuario, voce nao precisa - nem consegue - escrever o link): gerar_pdf, gerar_word
e gerar_excel pra documentos/relatorios/planilhas, gerar_grafico pra visualizar dados (barra,
linha ou pizza). Essas quatro sao de graca (bibliotecas locais, sem custo de API nenhum) - gere
sem duvidar quando fizer sentido pro pedido. Ja gerar_imagem_ia (foto/arte/ilustracao realista por
IA) tem custo real por uso - so chame quando o usuario pedir uma imagem gerada por IA de verdade,
nao confunda com grafico de dados (que e de graca). Depois de gerar qualquer arquivo, so confirme
de forma natural e breve que esta pronto - o botao de download ja aparece sozinho, nao descreva
"aqui esta o link" nem invente URL nenhuma.

Memoria: voce NUNCA esquece uma conversa sozinha - todo o historico fica salvo de verdade (nao
so na memoria do navegador), sobrevivendo a fechar o app, atualizar a pagina ou o servidor
reiniciar. So apaga quando o usuario pedir EXPLICITAMENTE (ferramenta esquecer_conversa) ou
clicar no botao "Limpar" - nunca por conta propria, nem quando o assunto mudar.

Voce tambem conversa com o usuario direto pelo WhatsApp, num numero dedicado so seu - funciona
igual ao chat do app (mesma personalidade, mesmas ferramentas, exceto controle do computador que
so funciona no app pelo navegador). Voce pode criar lembretes (whatsapp_criar_lembrete) que
chegam automaticamente no WhatsApp do usuario na hora marcada, venha o pedido do app ou do proprio
WhatsApp - sempre calcule a data/hora absoluta certa a partir do "hoje" que voce ja sabe. Use
whatsapp_listar_lembretes e whatsapp_cancelar_lembrete quando o usuario perguntar ou quiser
desmarcar algo.

Voce tem uma agenda propria (agenda_criar_evento, agenda_listar_eventos, agenda_cancelar_evento)
que funciona sozinha, e pode ficar OPCIONALMENTE sincronizada com o Google Agenda (o usuario liga
e desliga isso quando quiser na aba "Agenda" do app). Marque, consulte e cancele compromissos
livremente quando pedido - sempre calculando data/hora absoluta a partir do "agora" que voce ja
sabe. Quando a lista de eventos incluir itens vindos so do Google (campo origem: "google"), avise
que esses vieram de la e nao podem ser cancelados por voce (o usuario cancela direto no Google).

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
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' });
  // hora:minuto de verdade (nao so a data) - sem isso, qualquer pedido relativo ("me lembra
  // em 1 minuto", "daqui a meia hora") virava um chute, porque a Claude nao tinha como saber
  // que horas sao agora de verdade. Brasil nao tem mais horario de verao desde 2019, entao
  // Maceio e sempre UTC-03:00 - fixo, sem precisar calcular o offset dinamicamente.
  const agoraHora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Maceio', hour: '2-digit', minute: '2-digit' });
  let dinamico = `Agora sao ${agoraHora} de ${hoje} (fuso horario de Maceio/Brasil, UTC-03:00). Use isso pra calcular "hoje", "ontem", "essa semana", "daqui a X minutos/horas" etc sem precisar perguntar ao usuario - qualquer data/hora que voce gerar pra uma ferramenta (ex: lembretes) tem que ser calculada a partir desse horario real, nunca chutada.`;

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
  },
  {
    name: 'gerar_pdf',
    description: 'Gera um arquivo PDF de verdade, pronto pra download, a partir de um titulo e um texto - sem custo de API (biblioteca local). Use quando o usuario pedir um documento/relatorio/roteiro em PDF. No campo conteudo, escreva o texto corrido normalmente; uma linha comecando com "## " vira um subtitulo.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo do documento' },
        conteudo: { type: 'string', description: 'Corpo do documento em texto - use "## " no inicio de uma linha para criar um subtitulo' },
      },
      required: ['titulo', 'conteudo'],
    },
  },
  {
    name: 'gerar_word',
    description: 'Gera um arquivo Word (.docx) de verdade, pronto pra download, a partir de um titulo e um texto - sem custo de API (biblioteca local). Mesma formatacao simples do gerar_pdf ("## " vira subtitulo).',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo do documento' },
        conteudo: { type: 'string', description: 'Corpo do documento em texto - use "## " no inicio de uma linha para criar um subtitulo' },
      },
      required: ['titulo', 'conteudo'],
    },
  },
  {
    name: 'gerar_excel',
    description: 'Gera uma planilha Excel (.xlsx) de verdade, pronta pra download, com uma aba/tabela simples - sem custo de API (biblioteca local). Use pra listas, comparativos, relatorios tabulares.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo/nome da planilha' },
        colunas: { type: 'array', items: { type: 'string' }, description: 'Nomes das colunas (cabecalho)' },
        linhas: {
          type: 'array',
          items: { type: 'array', items: { type: ['string', 'number'] } },
          description: 'Cada item e uma linha da tabela, na mesma ordem das colunas',
        },
      },
      required: ['titulo', 'colunas', 'linhas'],
    },
  },
  {
    name: 'gerar_grafico',
    description: 'Gera uma imagem de grafico (SVG) de verdade, pronta pra download - sem custo de API (so geometria, biblioteca local). Use pra visualizar dados/comparativos (barra, linha ou pizza).',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo do grafico' },
        tipo: { type: 'string', enum: ['barra', 'linha', 'pizza'], description: 'Tipo de grafico' },
        rotulos: { type: 'array', items: { type: 'string' }, description: 'Rotulo de cada valor/fatia' },
        valores: { type: 'array', items: { type: 'number' }, description: 'Valores numericos, na mesma ordem dos rotulos' },
      },
      required: ['titulo', 'tipo', 'rotulos', 'valores'],
    },
  },
  {
    name: 'gerar_imagem_ia',
    description: 'Gera uma imagem de verdade (foto/arte/ilustracao realista) a partir de uma descricao, usando IA generativa de imagem - ATENCAO: diferente das outras ferramentas de arquivo, essa tem custo real por uso (chamada de API paga). So use quando o usuario pedir explicitamente uma imagem gerada por IA (nao confundir com grafico/infografico de dados, que e o gerar_grafico, gratuito).',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string', description: 'Descricao detalhada da imagem a gerar, em portugues ou ingles' },
      },
      required: ['descricao'],
    },
  },
  {
    name: 'whatsapp_criar_lembrete',
    description: 'Cria um lembrete que sera mandado automaticamente pro WhatsApp do usuario na data/hora marcada (funciona vindo de qualquer canal - app web ou o proprio WhatsApp). Use quando o usuario pedir pra ser lembrado de algo. Calcule "quando" como uma data/hora absoluta ISO 8601 (voce ja sabe a data de hoje pelo contexto do sistema).',
    input_schema: {
      type: 'object',
      properties: {
        mensagem: { type: 'string', description: 'O que lembrar, escrito de forma clara' },
        quando: { type: 'string', description: 'Data/hora exata do lembrete, formato ISO 8601 (ex: 2026-07-15T14:30:00-03:00)' },
      },
      required: ['mensagem', 'quando'],
    },
  },
  {
    name: 'whatsapp_listar_lembretes',
    description: 'Lista os lembretes pendentes (ainda nao enviados) do usuario.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'whatsapp_cancelar_lembrete',
    description: 'Cancela um lembrete pendente pelo id (use whatsapp_listar_lembretes primeiro pra saber o id certo).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id do lembrete a cancelar' } },
      required: ['id'],
    },
  },
  {
    name: 'agenda_criar_evento',
    description: 'Cria um evento/compromisso na agenda interna do usuario. Se a Google Agenda estiver conectada, o evento tambem e sincronizado la automaticamente (sem precisar fazer nada a mais). Calcule inicio/fim como data/hora absoluta ISO 8601 usando o "agora" que voce ja sabe.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Titulo/nome do compromisso' },
        descricao: { type: 'string', description: 'Detalhes opcionais do compromisso' },
        local: { type: 'string', description: 'Local opcional do compromisso' },
        inicio: { type: 'string', description: 'Data/hora de inicio, ISO 8601 (ex: 2026-07-16T09:00:00-03:00)' },
        fim: { type: 'string', description: 'Data/hora de fim, ISO 8601' },
      },
      required: ['titulo', 'inicio', 'fim'],
    },
  },
  {
    name: 'agenda_listar_eventos',
    description: 'Lista os compromissos da agenda num periodo (inclui eventos do Google Agenda tambem, se estiver conectada). Se nao passar from/to, mostra os proximos 30 dias a partir de agora.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Inicio do periodo, ISO 8601 (opcional)' },
        to: { type: 'string', description: 'Fim do periodo, ISO 8601 (opcional)' },
      },
    },
  },
  {
    name: 'agenda_cancelar_evento',
    description: 'Cancela/remove um compromisso da agenda interna pelo id (use agenda_listar_eventos primeiro pra saber o id certo). So funciona pra eventos criados pela propria Lumia (origem "lumia"), nao eventos que vieram so do Google.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id do evento a cancelar' } },
      required: ['id'],
    },
    // marca o fim do bloco de ferramentas como ponto de cache - a lista inteira (~30+
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

function nomeArquivoSeguro(titulo, extensao) {
  const base = (titulo || 'documento').trim().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_').slice(0, 60) || 'documento';
  return `${base}.${extensao}`;
}

// cada handler de geracao de arquivo devolve um marcador ___arquivoGerado (em vez do arquivo
// binario em si, que nao faz sentido mandar pro modelo de texto) - rodarLoopDeFerramentas
// intercepta esse marcador e expoe o link de download pro frontend, fora do fluxo normal de
// tool_result
async function handleGerarPdf({ titulo, conteudo }) {
  const buffer = await gerarPdf(titulo, conteudo);
  const nomeArquivo = nomeArquivoSeguro(titulo, 'pdf');
  const id = guardarArquivo(buffer, nomeArquivo, 'application/pdf');
  return { ___arquivoGerado: { id, nomeArquivo } };
}

async function handleGerarWord({ titulo, conteudo }) {
  const buffer = await gerarWord(titulo, conteudo);
  const nomeArquivo = nomeArquivoSeguro(titulo, 'docx');
  const id = guardarArquivo(buffer, nomeArquivo, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  return { ___arquivoGerado: { id, nomeArquivo } };
}

async function handleGerarExcel({ titulo, colunas, linhas }) {
  const buffer = await gerarExcel(titulo, colunas, linhas);
  const nomeArquivo = nomeArquivoSeguro(titulo, 'xlsx');
  const id = guardarArquivo(buffer, nomeArquivo, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return { ___arquivoGerado: { id, nomeArquivo } };
}

async function handleGerarGrafico({ titulo, tipo, rotulos, valores }) {
  const svg = gerarGraficoSvg(titulo, tipo, rotulos, valores);
  const nomeArquivo = nomeArquivoSeguro(titulo, 'svg');
  const id = guardarArquivo(Buffer.from(svg, 'utf8'), nomeArquivo, 'image/svg+xml');
  return { ___arquivoGerado: { id, nomeArquivo } };
}

async function handleGerarImagemIA({ descricao }) {
  const { buffer, mediaType } = await generateImageGemini(descricao);
  const extensao = mediaType.includes('png') ? 'png' : 'jpg';
  const nomeArquivo = nomeArquivoSeguro(descricao.slice(0, 40), extensao);
  const id = guardarArquivo(buffer, nomeArquivo, mediaType);
  return { ___arquivoGerado: { id, nomeArquivo } };
}

const toolHandlers = {
  gerar_pdf: handleGerarPdf,
  gerar_word: handleGerarWord,
  gerar_excel: handleGerarExcel,
  gerar_grafico: handleGerarGrafico,
  gerar_imagem_ia: handleGerarImagemIA,
  agenda_criar_evento: (input) => agenda.criarEvento(input),
  agenda_listar_eventos: ({ from, to }) => agenda.listarEventos(from, to),
  agenda_cancelar_evento: async ({ id }) => { await agenda.cancelarEvento(id); return { ok: true, mensagem: 'Evento removido da agenda.' }; },
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
  if (name === 'whatsapp_criar_lembrete') {
    try {
      const telefone = telefoneParaLembrete(sessionId);
      const { id, quando } = await criarLembrete(telefone, input.mensagem, input.quando);
      return { ok: true, id, quando, mensagem: 'Lembrete criado, vou mandar no WhatsApp na hora certa.' };
    } catch (err) {
      return { erro: err.message };
    }
  }
  if (name === 'whatsapp_listar_lembretes') {
    try {
      const telefone = telefoneParaLembrete(sessionId);
      const lembretes = await listarLembretesPendentes(telefone);
      return { lembretes };
    } catch (err) {
      return { erro: err.message };
    }
  }
  if (name === 'whatsapp_cancelar_lembrete') {
    try {
      const telefone = telefoneParaLembrete(sessionId);
      await cancelarLembrete(input.id, telefone);
      return { ok: true, mensagem: 'Lembrete cancelado.' };
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
// video viram blocos de imagem de verdade pro Claude "ver"; PDF vira um bloco de documento (a
// Claude le o PDF de verdade - texto, tabelas e paginas escaneadas - sem precisar de OCR a
// parte); audio e transcrito (fala -> texto) e entra como texto na propria mensagem.
async function buildUserContent(userMessage, attachments) {
  const arquivos = [];
  let transcricoes = '';

  for (const att of attachments || []) {
    if (!att || !att.base64) continue;

    if (att.kind === 'image' || att.kind === 'video_frame') {
      const mediaType = IMAGE_MEDIA_TYPES.has(att.mediaType) ? att.mediaType : 'image/jpeg';
      arquivos.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: att.base64 } });
    } else if (att.kind === 'document') {
      arquivos.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.base64 } });
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
  if (!texto && arquivos.length) texto = 'O usuario enviou arquivo(s) para voce analisar - veja os anexos.';

  if (!arquivos.length) return texto;
  const content = [];
  if (texto) content.push({ type: 'text', text: texto });
  content.push(...arquivos);
  return content;
}

// Depois que a Lumia ja respondeu usando uma imagem ou PDF, troca o bloco no historico por um
// marcador leve - senao o binario seria reenviado (e recobrado) em todo turno seguinte da
// mesma sessao. A analise em texto que a Lumia deu ja fica registrada na resposta.
function apagarImagensAntigas(history) {
  for (const turn of history) {
    if (Array.isArray(turn.content)) {
      turn.content = turn.content.map((b) => {
        if (b.type === 'image') return { type: 'text', text: '[imagem enviada anteriormente pelo usuario, ja analisada]' };
        if (b.type === 'document') return { type: 'text', text: '[PDF enviado anteriormente pelo usuario, ja analisado]' };
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
          // repara aqui tambem: sessoes que ja ficaram com um tool_result orfao salvo no banco
          // (de antes desse fix, ou de uma interrupcao a meio do loop) precisam disso pra sair
          // do estado quebrado, senao toda mensagem nessa sessao volta a falhar pra sempre.
          history: repararHistorico(rows[0].history || []),
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

// ---------- Lembretes por WhatsApp ----------
// se o pedido veio de uma conversa no WhatsApp (sessionId no formato "whatsapp-evo:<numero>"),
// o lembrete vai pro mesmo numero de quem pediu; se veio do app web (sem numero de WhatsApp
// associado), cai no numero admin configurado - assim "me lembra de X" funciona nos dois canais
function telefoneParaLembrete(sessionId) {
  if (sessionId?.startsWith('whatsapp-evo:')) return sessionId.slice('whatsapp-evo:'.length);
  return process.env.LUMIA_WHATSAPP_ADMIN || null;
}

async function criarLembrete(telefone, mensagem, quandoISO) {
  if (!pool) throw new Error('Lembretes precisam do Postgres configurado (DATABASE_URL) - nao disponivel neste ambiente.');
  if (!telefone) throw new Error('Nao sei pra qual numero de WhatsApp mandar esse lembrete (nenhum configurado).');
  await tabelasProntas;
  const quando = new Date(quandoISO);
  if (Number.isNaN(quando.getTime())) throw new Error(`Data/hora invalida: "${quandoISO}"`);
  const { rows } = await pool.query(
    'INSERT INTO lembretes (telefone, mensagem, quando) VALUES ($1, $2, $3) RETURNING id',
    [telefone, mensagem, quando],
  );
  return { id: rows[0].id, quando: quando.toISOString() };
}

async function listarLembretesPendentes(telefone) {
  if (!pool) return [];
  await tabelasProntas;
  const { rows } = await pool.query(
    'SELECT id, mensagem, quando FROM lembretes WHERE telefone = $1 AND enviado = false ORDER BY quando ASC',
    [telefone],
  );
  return rows;
}

async function cancelarLembrete(id, telefone) {
  if (!pool) throw new Error('Lembretes precisam do Postgres configurado.');
  const { rowCount } = await pool.query(
    'DELETE FROM lembretes WHERE id = $1 AND telefone = $2 AND enviado = false',
    [id, telefone],
  );
  if (!rowCount) throw new Error(`Nao achei nenhum lembrete pendente com id ${id} pra esse numero.`);
}

// roda em segundo plano no processo do servidor - a cada 30s checa se algum lembrete venceu
// e manda pelo WhatsApp (Evolution API). So chamado uma vez, no boot do server.js.
export function iniciarSchedulerLembretes() {
  if (!pool) return;
  setInterval(async () => {
    try {
      await tabelasProntas;
      const { rows } = await pool.query(
        'SELECT id, telefone, mensagem FROM lembretes WHERE enviado = false AND quando <= now()',
      );
      for (const lembrete of rows) {
        try {
          await enviarMensagemTexto(lembrete.telefone, `⏰ Lembrete: ${lembrete.mensagem}`);
          await pool.query('UPDATE lembretes SET enviado = true WHERE id = $1', [lembrete.id]);
        } catch (err) {
          console.error(`Erro mandando lembrete ${lembrete.id} pro WhatsApp:`, err.message);
        }
      }
    } catch (err) {
      console.error('Erro checando lembretes pendentes:', err.message);
    }
  }, 30 * 1000).unref();
}

export async function limparConversa(sessionId) {
  await limparSessao(sessionId);
}

const MAX_TOOL_ROUNDS = 10;
const MAX_HISTORY = 40;

// a API da Anthropic exige que todo tool_result tenha o tool_use correspondente na mensagem
// anterior - um tool_use e o(s) tool_result(s) dele sao sempre pushados como mensagens
// adjacentes no historico (ver rodarLoopDeFerramentas/continuarAcaoLocal), mas SEPARADAS (uma
// e 'assistant', a outra e 'user'). Se algo cortar o historico entre essas duas mensagens - o
// corte por tamanho de aparaHistorico() e o principal suspeito, mas uma sessao ja salva assim
// no Postgres (de antes desse fix, ou de uma interrupcao) tambem serve - sobra um tool_result
// orfao como resultado, e a proxima chamada pra API quebra com 400 pra sempre nessa sessao.
// Essa funcao varre o historico e descarta qualquer bloco tool_result cujo tool_use_id nao
// esteja "aberto" (tool_use visto antes e ainda nao fechado); se a mensagem ficar sem nenhum
// bloco depois disso, ela e descartada inteira.
function repararHistorico(history) {
  const abertos = new Set();
  const reparado = [];
  for (const msg of history) {
    if (msg.role === 'assistant') {
      reparado.push(msg);
      if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b.type === 'tool_use') abertos.add(b.id);
        }
      }
      continue;
    }
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const blocosValidos = msg.content.filter((b) => {
        if (b.type !== 'tool_result') return true;
        const valido = abertos.has(b.tool_use_id);
        if (valido) abertos.delete(b.tool_use_id);
        return valido;
      });
      if (!blocosValidos.length) continue;
      reparado.push(blocosValidos.length === msg.content.length ? msg : { ...msg, content: blocosValidos });
      continue;
    }
    reparado.push(msg);
  }
  return reparado;
}

function aparaHistorico(session) {
  if (session.history.length > MAX_HISTORY) {
    session.history.splice(0, session.history.length - MAX_HISTORY);
  }
  session.history = repararHistorico(session.history);
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
    let arquivoGerado = null;
    for (const block of toolUseBlocks) {
      const result = await runTool(block.name, block.input, session, sessionId);
      if (result && result.___esqueceuTudo) { esqueceuTudo = true; continue; }
      if (result && result.___arquivoGerado) {
        arquivoGerado = result.___arquivoGerado;
        // o Claude so precisa saber que deu certo pra confirmar naturalmente - o link de
        // download em si vai direto pro frontend fora desse tool_result, nao faz sentido
        // (nem cabe) mandar o arquivo binario de volta pro modelo de texto
        toolResults.push({
          type: 'tool_result', tool_use_id: block.id,
          content: JSON.stringify({ ok: true, nomeArquivo: arquivoGerado.nomeArquivo, mensagem: 'Arquivo gerado - o link de download ja apareceu pro usuario na interface, so confirme de forma natural que esta pronto.' }),
        });
        continue;
      }
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
    if (arquivoGerado) {
      const replyText = extractText(response) || 'Prontinho, gerei o arquivo.';
      session.history.push({ role: 'assistant', content: replyText });
      aparaHistorico(session);
      return { texto: replyText, arquivo: arquivoGerado };
    }
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
    if (resultado.localAction) return { reply: null, localAction: resultado.localAction };
    return { reply: resultado.texto, arquivo: resultado.arquivo || undefined };
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
    const saida = r.localAction ? { reply: null, localAction: r.localAction } : { reply: r.texto, arquivo: r.arquivo || undefined };
    await salvarSessao(sessionId, session);
    return saida;
  } catch (err) {
    session.history.splice(tamanhoAntes);
    await salvarSessao(sessionId, session);
    throw err;
  }
}
