# GDR Formação 360

PWA mobile-first para gestão dos escalões de formação do GDR Faro do Alentejo.

## Funcionalidades desta versão

- Gestão de atletas por escalão: Traquinas, Benjamins e Traquinas/Benjamins
- Registo de treinos
- Presenças: Presente, Falta e Justificada
- Avaliação 1–5 de Atitude, Empenho e Comportamento
- Observações por atleta/treino
- Dashboard com assiduidade e índice de treino
- Sugestão de convocatória com base nos dados registados
- PWA instalável no telemóvel
- Modo demo/local via `localStorage`
- Backend Google Apps Script preparado para Google Sheets

## Publicar no GitHub Pages

1. Carregar todos os ficheiros desta pasta para a raiz do repositório.
2. No GitHub: Settings → Pages.
3. Em Build and deployment escolher `Deploy from a branch`.
4. Branch: `main` / pasta `/root`.
5. Guardar.

## Ligar ao Google Sheets

1. Criar uma Google Sheet para a app.
2. Extensions → Apps Script.
3. Copiar `backend/Code.gs` para o editor.
4. Executar manualmente a função `setup()` uma vez e autorizar.
5. Deploy → New deployment → Web app.
6. Execute as: Me. Access: Anyone with the link (ou a política adequada ao clube).
7. Copiar o URL terminado em `/exec`.
8. Colocar esse URL em `config.js` no campo `API_URL`.
9. Mudar `DEMO_MODE` para `false` quando a integração do frontend estiver ativada.

## Nota

Nesta primeira versão o frontend funciona totalmente em modo local para poder ser testado imediatamente. A camada Apps Script está criada como base do backend e será ligada ao frontend na versão seguinte.
