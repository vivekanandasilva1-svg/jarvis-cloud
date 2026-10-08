# Preferencias de trabalho

O dono do projeto (Vivekananda) autorizou operar de forma autonoma neste repositorio: nao
preciso pedir confirmacao antes de editar arquivos, commitar, dar push pra `origin/main`,
rodar comandos, subir o preview local ou fazer deploy. Pode seguir direto.

Excecoes onde ainda vale confirmar antes de agir, por serem dificeis de reverter ou
envolverem dinheiro/terceiros de verdade:
- Ativar campanha ou aumentar orcamento de anuncio (ja tem fluxo proprio de confirmacao no
  Lumia - `ads_criar_campanha`, `ads_alterar_status_campanha`, `ads_alterar_orcamento_adset`)
- Operacoes destrutivas de git (force-push, reset --hard, apagar branch)
- Mandar mensagem pra alguem fora do projeto (ex: WhatsApp real do paciente) sem ser a pedido
  direto do Vivekananda

# Cerebro-mae (memoria viva do app)

Toda entrega nova (funcao, melhoria, correcao relevante ou decisao) deve ganhar uma entrada em
`cerebro-mae/historico.json` - no modulo certo (`modulo` = hub existente, `data`, `tipo`, `titulo`,
`conteudo` curto com o PORQUE e o que ficou pendente). O arquivo vai no deploy e o
`src/cerebroMae.js` sincroniza sozinho com o Cerebro do dono (cria/atualiza, liga ao hub do
modulo e a evolucao anterior). Modulo novo = adicionar um hub `mod:<nome>` antes das entradas.
Nunca colocar senha, token ou dado pessoal de paciente/cliente nessas entradas.
