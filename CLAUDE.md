# Preferencias de trabalho

O dono do projeto (Vivekananda) autorizou operar de forma autonoma neste repositorio: nao
preciso pedir confirmacao antes de editar arquivos, commitar, dar push pra `origin/main`,
rodar comandos, subir o preview local ou fazer deploy. Pode seguir direto.

Excecoes onde ainda vale confirmar antes de agir, por serem dificeis de reverter ou
envolverem dinheiro/terceiros de verdade:
- Ativar campanha ou aumentar orcamento de anuncio (ja tem fluxo proprio de confirmacao no
  Klaus - `ads_criar_campanha`, `ads_alterar_status_campanha`, `ads_alterar_orcamento_adset`)
- Operacoes destrutivas de git (force-push, reset --hard, apagar branch)
- Mandar mensagem pra alguem fora do projeto (ex: WhatsApp real do paciente) sem ser a pedido
  direto do Vivekananda
