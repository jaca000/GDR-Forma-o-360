# GDR Formação 360 — v15.1

Aplicação móvel/PWA para a formação do GDR Faro do Alentejo. O pacote é **flat**: todos os ficheiros ficam na raiz do repositório GitHub.

## Novidades

- Textos de treino revistos com linguagem própria da formação futebolística, distinguindo intensidade, resposta às tarefas, concentração, disciplina, integração coletiva e indicadores técnico-táticos efetivamente assinalados.
- Novas tags técnicas no registo: qualidade técnica, tomada de decisão, posicionamento, passe e receção, finalização e transição.
- Os textos antigos são atualizados progressivamente para a nova versão técnica quando a ficha do atleta é consultada.
- Novo ecrã de carregamento animado, com logótipo, progresso e etapas de sincronização, deixando claro que a aplicação está ativa.
- O antigo gráfico de barras foi substituído por uma linha temporal com trajetórias separadas para atitude, empenho e comportamento.

- Dashboard técnico totalmente separado por **Traquinas** e **Benjamins**, incluindo atletas, número de treinos, médias, destaques, alertas e índice de treino.
- Texto automático individual para cada treino, criado em segundo plano a partir de presença, atitude, empenho, comportamento, tags e observação, sem atrasar a gravação.
- Nova folha `TRAINING_SUMMARIES`, com histórico das análises individuais geradas para cada atleta e treino.
- Ficha do atleta com análise de desenvolvimento avançada: índice recente, consistência, assiduidade recente, ponto forte, próximo foco e comparação de cada dimensão com o período anterior.

- Cada notificação do mural abre agora diretamente o aviso correspondente numa página individual, sem mostrar a lista completa de avisos.
- O botão **Ler aviso completo** do dashboard também abre apenas a mensagem selecionada.

- Otimização global do desempenho no login e em todas as gravações.
- As sessões válidas deixam de reler a folha de utilizadores em cada ação; alterações de acesso invalidam imediatamente essa validação.
- Os dados de entrada são comprimidos e guardados temporariamente em cache, acelerando logins e reaberturas sem misturar dados entre famílias.
- Registos múltiplos, incluindo os atletas de um treino, passam a ser escritos em bloco em vez de uma linha de cada vez.
- Eliminações com vários registos também são processadas em bloco.
- A sincronização integral após alterações é agrupada e feita depois de um período sem atividade, evitando que uma gravação torne a seguinte lenta.
- Novo botão **Ativar alertas no telemóvel** na área de notificações, com avisos de mural, disponibilidades, convocatórias, treinos, calendário, mensalidades e ficha de segurança.
- Os alertas usam apenas os dados autorizados para cada conta; cada família continua a receber exclusivamente informação dos filhos associados.
- Nesta versão, as notificações do sistema funcionam com a PWA aberta ou ainda ativa em segundo plano. Alertas garantidos com a aplicação totalmente encerrada exigem configurar posteriormente um fornecedor Web Push, como Firebase Cloud Messaging.

- Corrigida a leitura do **Mural GDR** no Portal dos Pais: os avisos ativos voltam a aparecer no dashboard de acordo com as datas e o escalão.
- Reposta a ligação às folhas `ANNOUNCEMENTS` e `NOTIFICATION_READS`, preservando os avisos já existentes e o estado das notificações.

- Os jogos e torneios podem agora ser editados diretamente no **Modo Dia de Jogo**, exclusivamente pelo utilizador `josealmanso`.
- É possível corrigir adversário/título, data, hora e local e escolher o equipamento **Vermelho**, **Branco** ou **Por definir**.
- A alteração da data preserva o pedido de disponibilidade e as respostas já registadas, atualizando a data associada.
- O equipamento passa a ser guardado também nos eventos manuais e aparece no Modo Dia de Jogo.

- Login acelerado: a autenticação já devolve os dados necessários no mesmo pedido, eliminando uma segunda chamada completa ao Apps Script.
- Sessões ativas identificadas em cache para evitar percorrer continuamente todo o histórico de sessões; o estado atual do utilizador continua a ser validado na folha `USERS`.
- Gravação de treinos sem nova leitura integral para deduplicação e sem descarregar novamente toda a base de dados após guardar.
- O treino e os respetivos registos são devolvidos na resposta e atualizados imediatamente no ecrã, mantendo os identificadores únicos que impedem duplicados.

- Nova área **Segurança do atleta**, com contactos de emergência, pessoas autorizadas a recolher, alertas críticos, medicação de emergência, limitações temporárias e instruções de atuação.
- A família só consulta e altera a ficha dos filhos associados; o controlo é aplicado também no servidor.
- A equipa técnica dispõe de consulta em contexto de necessidade, sem permissão para alterar; o Admin pode consultar e atualizar.
- Consentimento explícito obrigatório, confirmação anual visível e histórico de consultas/alterações na folha `SAFETY_ACCESS_LOG`.
- Botões de chamada direta para os contactos de emergência no telemóvel.

- Mural de avisos do clube, com destinatários por escalão, prioridade e período de publicação; apenas `josealmanso` publica ou elimina.
- Novo desenho do mural: destaque horizontal, pré-visualização curta, etiquetas claras e leitura completa numa página própria.
- Notificações internas pessoais com contador de não lidas para novos avisos, disponibilidades por responder e convocatórias.
- Estado de leitura guardado na Sheet e associado ao utilizador, funcionando em diferentes dispositivos.
- Modo Dia de Jogo com contagem decrescente, data, hora, local, equipamento, disponibilidade e convocatória.
- No perfil técnico, o Modo Dia de Jogo apresenta totais e atalhos para disponibilidade, convocatória e sete inicial.
- No Portal dos Pais, mostra exclusivamente a informação do próprio filho e só permite responder quando o pedido estiver aberto.

- Portal dos Pais completamente renovado: cabeçalho com fotografia, nome, escalão e tendência de evolução.
- Disponibilidades abertas em destaque no início, com resposta ou alteração imediata para o filho selecionado.
- Painel familiar com assiduidade, treinos do mês, empenho, comportamento, evolução recente e próximos eventos.
- Histórico dos treinos recentes, com acesso ao resumo individual do filho sem expor dados de outros atletas.
- Resumo mensal criado automaticamente por IA apenas a partir dos registos dos treinos, sem intervenção ou validação da equipa técnica.
- No Portal dos Pais esta área chama-se **Evolução do atleta** e não apresenta referências técnicas à utilização de IA.
- Enquanto ainda não houver dados suficientes, é mostrado um acompanhamento discreto, sem mensagens de erro ou “resumo indisponível”.
- Linguagem adequada aos pais, sem comparações entre crianças, diagnósticos ou exposição das classificações numéricas.
- Famílias com vários filhos podem alternar entre atletas no topo do portal; todos os dados continuam filtrados no servidor.
- Mensalidades no Portal dos Pais com situação atual e histórico mensal do próprio filho.
- Convocatórias publicadas com adversário, data, hora, local, escalão e equipamento.
- Objetivo do mês escolhido automaticamente a partir da área com maior margem de progressão nos registos atuais.
- Conquistas automáticas por primeiro treino, assiduidade total, sequência de presenças, empenho, comportamento e convocatórias.

- Portal dos Pais com contas próprias associadas pelo Admin a um ou mais filhos.
- Filtragem obrigatória no servidor: cada família recebe exclusivamente dados dos filhos associados.
- Pedidos de disponibilidade abertos pelo Admin diretamente no jogo ou torneio do Calendário, com prazo de resposta.
- Mensagem genérica gerada e copiada automaticamente para publicação no grupo de WhatsApp dos pais, sem API paga.
- Após abrir o pedido, a mensagem fica sempre visível no ecrã; inclui botões separados para copiar ou abrir o WhatsApp, evitando bloqueios da área de transferência no telemóvel.
- Apenas o utilizador exato `josealmanso` pode abrir, atualizar ou apagar pedidos de disponibilidade; a regra é validada também no servidor.
- O menu, a lista e os dados de utilizadores são visíveis exclusivamente para `josealmanso`; só essa conta pode criar, editar, ativar ou desativar qualquer perfil.
- Ao apagar um pedido, são eliminadas após confirmação as respostas associadas àquele evento e escalão.
- Link direto para o Portal dos Pais, onde cada família responde Disponível/Indisponível e pode acrescentar observação.
- Pais podem também consultar o calendário do escalão e comunicar ou cancelar faltas antecipadas dos próprios filhos.
- Contas de pais não conseguem executar ações técnicas, administrativas ou consultar outros atletas, mesmo através da API.

- Histórico de treinos clicável a partir do Calendário, do início e do Registo Express.
- Resumo detalhado de cada treino com presenças, faltas, justificações, assiduidade, médias, avaliações, tags e observações por atleta.
- O Admin pode eliminar um treino duplicado; os registos associados são removidos em conjunto após confirmação explícita.
- Aviso antes de guardar outro treino do mesmo escalão no mesmo dia, reduzindo duplicações acidentais.
- Gravação de todos os atletas do treino em bloco, reduzindo fortemente o tempo de espera à medida que o histórico cresce.
- Botão Guardar bloqueado durante o envio para impedir duplos toques e registos repetidos.
- Correção automática dos registos antigos duplicados: fica apenas o registo mais recente de cada atleta em cada treino.
- A leitura da app ignora imediatamente duplicações antigas, evitando atletas repetidos e cálculos de assiduidade incorretos.

- Mensalidades de 10€/mês desde outubro de 2026, com prazo normal entre os dias 1 e 8.
- Pago, Em falta, Isento ou Pendente; Numerário/MB Way; data, observação, totais e filtros.
- Número de pagamento automático no formato `GDR-PAG-2026-00001`.
- Comprovativo interno imprimível/PDF, claramente identificado como documento sem valor fiscal.
- Alertas automáticos por email: dia 6, dia 9 e semanalmente após o prazo enquanto existirem pagamentos em falta.
- Treinadores consultam; só o Admin altera, com validação no servidor.
- Faltas antecipadas comunicadas pelos pais, com atleta, data, motivo e observação.
- O atleta com falta antecipada não aparece no Registo Express nessa data; a falta justificada é gravada automaticamente no histórico.
- A falta antecipada pode ser cancelada se o atleta afinal conseguir comparecer, voltando imediatamente à lista do treino.
- Novo painel inicial operacional: agenda de hoje/próximo evento, semáforo global, atletas a acompanhar, resumo do último treino, faltas comunicadas e mensalidades.
- Lista de tarefas pendentes gerada automaticamente: faltas do dia, atletas em atenção, jogos sem sete inicial, mensalidades em falta, fotografias e números de equipamento por completar.
- Conteúdo do painel adaptado ao perfil Admin ou Treinador.
- Na lista de faltas antecipadas, cada atleta apresenta imediatamente o badge do escalão: Traquinas, Benjamins ou misto.
- Resumo visual das próximas faltas com contagem total e separação por Traquinas e Benjamins.
- Disponibilidade diretamente nos jogos e torneios já existentes no Calendário, com estados Disponível, Indisponível e Sem resposta, observação e totais imediatos.
- Disponibilidade independente por escalão; num evento para Todos, Traquinas e Benjamins têm respostas e totais separados.
- Fluxo integrado sem duplicações: Calendário → disponibilidade por escalão → convocatória → sete inicial.
- Ao guardar a convocatória, o jogo fica no histórico interno sem criar uma cópia visual no Calendário.
- A sugestão de convocatória dá prioridade aos disponíveis, considera os atletas sem resposta e exclui os indisponíveis.
- Aviso e bloqueio de atletas indisponíveis na convocatória.
- Resumo semanal completo, navegável por semana e separado por Traquinas e Benjamins: treinos, jogos, assiduidade, faltas, empenho, comportamento, destaques e próxima semana.
- Resumo semanal imprimível/PDF e envio automático por email todas as segundas-feiras.
- Botão de envio imediato do resumo semanal para teste ou partilha interna.
- Sete inicial visual e arrastável com foto, nome, número e equipamento vermelho/branco.
- Semáforo explicado por assiduidade recente, comportamento, empenho e evolução.
- Calendário com treinos, jogos, torneios, outros eventos e próximos eventos no início.
- Mantém atletas, fotos, treinos, convocatórias, PDFs, ficha individual, evolução, tags, destaques e histórico.

## Migração segura da Google Sheet

1. Faça uma cópia de segurança da Sheet: **Ficheiro → Fazer uma cópia**.
2. Abra **Extensões → Apps Script** na Sheet atual.
3. Substitua `Code.gs` pelo ficheiro desta v13.3 e guarde.
4. Execute `setup()` **uma vez** e autorize as permissões.
5. Vá a **Implementar → Gerir implementações → Editar → Nova versão → Implementar**.
6. Mantenha o mesmo endereço `/exec`; o `config.js` conserva o endereço atual.

`setup()` acrescenta as folhas/colunas em falta e preserva atletas, fotos, treinos, convocatórias e registos válidos. Remove apenas linhas comprovadamente duplicadas em `RECORDS` — mesmo treino e mesmo atleta — mantendo o registo mais recente. Também cria/atualiza `MONTHLY_FEES`, `EVENTS`, `LINEUPS`, `SETTINGS`, `PLANNED_ABSENCES`, `GAME_AVAILABILITY`, `AVAILABILITY_REQUESTS`, `AI_MONTHLY_SUMMARIES`, `TRAINING_SUMMARIES`, `ANNOUNCEMENTS`, `NOTIFICATION_READS`, `ATHLETE_SAFETY` e `SAFETY_ACCESS_LOG`, bem como os alertas e automatismos. A migração não apaga fichas nem dados clínicos existentes.

## Resumos mensais por IA

1. No Apps Script, abra **Definições do projeto → Propriedades do script**.
2. Crie a propriedade `OPENAI_API_KEY` com uma chave da API da OpenAI. Nunca coloque a chave em `config.js`, no GitHub ou no navegador.
3. Opcionalmente, crie `OPENAI_MODEL` para escolher outro modelo compatível; sem esta propriedade é usado `gpt-5.4-mini`.
4. Execute novamente `setup()` para criar o acionador diário.

Nos dias 1 a 3 de cada mês, o sistema gera uma vez o resumo do mês anterior. O utilizador `josealmanso` também dispõe da ação **Gerar resumos IA** no painel para testar ou gerar um mês específico. Sem chave configurada, os restantes módulos continuam a funcionar e o portal mostra que o resumo ainda não está disponível. A utilização da API pode ter custos conforme o modelo e o volume de geração.

## Upload no GitHub

1. Descompacte o ZIP.
2. Em **Add file → Upload files**, carregue todos os ficheiros da raiz por cima dos atuais.
3. Confirme o commit. Se a app instalada ainda mostrar a v8, feche-a e volte a abrir para atualizar a cache.

## Segurança

Numa Sheet nova, `setup()` cria `admin / 1234`; altere esse PIN imediatamente. Numa Sheet existente, utilizadores e PIN são preservados. Gestão de atletas, utilizadores, mensalidades e eventos manuais exige perfil `admin` no Apps Script, não apenas no ecrã.

## Teste após instalação

1. Confirme atletas/fotos e abra uma ficha com semáforo.
2. Registe um treino de teste.
3. Registe uma Falta antecipada para hoje e confirme que o atleta deixa de aparecer no treino; cancele-a e confirme que volta a aparecer.
4. Em Mensalidades, confirme o email dos alertas e carregue em **Guardar**.
5. Marque uma mensalidade como paga, confirme o número automático e imprima o comprovativo interno.
6. Guarde uma convocatória e prepare o Sete inicial no histórico de jogos.
7. Crie um Torneio no Calendário e confirme-o em Próximos eventos.
8. Crie um Jogo ou Torneio no Calendário, abra a disponibilidade do respetivo escalão e confirme que a convocatória usa esse evento e exclui os indisponíveis.
9. Abra Resumo semanal, confirme o email, imprima o PDF e teste Enviar agora.
10. Abra um treino através do Calendário, confirme o resumo e verifique que o botão Eliminar aparece apenas ao Admin.
11. Em Utilizadores, crie uma conta Pai/Mãe, associe o respetivo filho e defina utilizador/PIN.
12. Num jogo do Calendário, abra Disponibilidade, defina o prazo e use “Abrir pedido e copiar mensagem”.
13. Cole a mensagem no grupo dos pais e teste o link com a conta familiar.
14. Configure `OPENAI_API_KEY`, use **Gerar resumos IA** e confirme no Portal dos Pais o texto do mês selecionado.
15. No Portal dos Pais, abra **Segurança do atleta**, preencha o contacto principal, aceite o consentimento e confirme que a equipa técnica consegue consultar mas não alterar.
16. Execute `setup()` e confirme a criação das folhas `ATHLETE_SAFETY` e `SAFETY_ACCESS_LOG`.

Versão: **13.3.0**.
