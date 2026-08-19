# GDR Formação 360 — v5 CLOUD

Versão preparada para dados centralizados em Google Sheets + Google Apps Script.

## O que muda
- Login e PIN passam a ser validados no backend.
- Administrador e Treinador têm permissões reais no servidor.
- Apenas o Administrador cria/edita/desativa atletas e utilizadores.
- Treinos e avaliações ficam centralizados e visíveis em todos os dispositivos.
- Fotografias dos atletas podem ser escolhidas diretamente no telemóvel.
- A fotografia é reduzida no browser antes do upload.
- O Apps Script guarda a fotografia numa pasta do Google Drive e a Sheet guarda o ID/URL.

## Instalação rápida
1. Criar uma Google Sheet vazia, por exemplo `GDR Formação 360 - Base de Dados`.
2. Extensões → Apps Script.
3. Apagar o conteúdo de `Code.gs` e colar o `Code.gs` desta versão.
4. Guardar.
5. Executar manualmente a função `setup()` uma vez e autorizar.
6. Confirmar que foram criadas as folhas USERS, ATHLETES, TRAININGS, RECORDS, GAMES, CALLUPS e SESSIONS.
7. Implementar → Nova implementação → Aplicação Web.
8. Executar como: `Eu`.
9. Quem tem acesso: `Qualquer pessoa`.
10. Copiar o URL terminado em `/exec`.
11. Abrir `config.js` e colar esse URL em `API_URL`.
12. Carregar todos os ficheiros desta versão no GitHub.
13. Login inicial: `admin` / `1234`.
14. Entrar como Administrador e alterar/criar os utilizadores pretendidos.

## Fotografias e privacidade
Para as fotos aparecerem em qualquer telemóvel sem cada treinador ter de autenticar no Google Drive, o script configura cada ficheiro como **"Qualquer pessoa com o link pode ver"**. O link não é listado publicamente, mas quem obtiver o URL consegue ver a foto. Se pretenderes um armazenamento totalmente privado/autenticado, devemos trocar esta parte por armazenamento privado (por exemplo Supabase Storage) antes de colocar fotografias reais de menores.

## Importante
Depois de publicar uma nova versão do Apps Script, mantém o mesmo deployment e usa `Gerir implementações → Editar → Nova versão` para não mudares o URL `/exec`.
