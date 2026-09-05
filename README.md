# GDR Formação 360 — v11.2

Aplicação móvel/PWA para a formação do GDR Faro do Alentejo. O pacote é **flat**: todos os ficheiros ficam na raiz do repositório GitHub.

## Novidades

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
3. Substitua `Code.gs` pelo ficheiro desta v11.2 e guarde.
4. Execute `setup()` **uma vez** e autorize as permissões.
5. Vá a **Implementar → Gerir implementações → Editar → Nova versão → Implementar**.
6. Mantenha o mesmo endereço `/exec`; o `config.js` conserva o endereço atual.

`setup()` acrescenta as folhas/colunas em falta e preserva atletas, fotos, treinos, convocatórias e registos válidos. Remove apenas linhas comprovadamente duplicadas em `RECORDS` — mesmo treino e mesmo atleta — mantendo o registo mais recente. Também cria/atualiza `MONTHLY_FEES`, `EVENTS`, `LINEUPS`, `SETTINGS`, `PLANNED_ABSENCES`, `GAME_AVAILABILITY` e `AVAILABILITY_REQUESTS`, os alertas das mensalidades e o envio automático do resumo semanal.

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

Versão: **11.2.0**.
