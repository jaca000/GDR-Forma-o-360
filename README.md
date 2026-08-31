# GDR Formação 360 — v9.1

Aplicação móvel/PWA para a formação do GDR Faro do Alentejo. O pacote é **flat**: todos os ficheiros ficam na raiz do repositório GitHub.

## Novidades

- Mensalidades de 10€/mês desde outubro de 2026, com prazo normal entre os dias 1 e 8.
- Pago, Em falta, Isento ou Pendente; Numerário/MB Way; data, observação, totais e filtros.
- Número de pagamento automático no formato `GDR-PAG-2026-00001`.
- Comprovativo interno imprimível/PDF, claramente identificado como documento sem valor fiscal.
- Alertas automáticos por email: dia 6, dia 9 e semanalmente após o prazo enquanto existirem pagamentos em falta.
- Treinadores consultam; só o Admin altera, com validação no servidor.
- Sete inicial visual e arrastável com foto, nome, número e equipamento vermelho/branco.
- Semáforo explicado por assiduidade recente, comportamento, empenho e evolução.
- Calendário com treinos, jogos, torneios, outros eventos e próximos eventos no início.
- Mantém atletas, fotos, treinos, convocatórias, PDFs, ficha individual, evolução, tags, destaques e histórico.

## Migração segura da Google Sheet

1. Faça uma cópia de segurança da Sheet: **Ficheiro → Fazer uma cópia**.
2. Abra **Extensões → Apps Script** na Sheet atual.
3. Substitua `Code.gs` pelo ficheiro desta v9 e guarde.
4. Execute `setup()` **uma vez** e autorize as permissões.
5. Vá a **Implementar → Gerir implementações → Editar → Nova versão → Implementar**.
6. Mantenha o mesmo endereço `/exec`; o `config.js` conserva o endereço atual.

`setup()` acrescenta apenas folhas/colunas em falta, sem limpar ou eliminar linhas. Cria/atualiza `MONTHLY_FEES`, `EVENTS`, `LINEUPS` e `SETTINGS`; atletas, fotos, treinos, registos e convocatórias existentes são preservados. Também cria o alerta diário automático das mensalidades.

## Upload no GitHub

1. Descompacte o ZIP.
2. Em **Add file → Upload files**, carregue todos os ficheiros da raiz por cima dos atuais.
3. Confirme o commit. Se a app instalada ainda mostrar a v8, feche-a e volte a abrir para atualizar a cache.

## Segurança

Numa Sheet nova, `setup()` cria `admin / 1234`; altere esse PIN imediatamente. Numa Sheet existente, utilizadores e PIN são preservados. Gestão de atletas, utilizadores, mensalidades e eventos manuais exige perfil `admin` no Apps Script, não apenas no ecrã.

## Teste após instalação

1. Confirme atletas/fotos e abra uma ficha com semáforo.
2. Registe um treino de teste.
3. Em Mensalidades, confirme o email dos alertas e carregue em **Guardar**.
4. Marque uma mensalidade como paga, confirme o número automático e imprima o comprovativo interno.
5. Guarde uma convocatória e prepare o Sete inicial no histórico de jogos.
6. Crie um Torneio no Calendário e confirme-o em Próximos eventos.

Versão: **9.1.0**.
