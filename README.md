# GDR Formação 360 — v6 Convocatórias

## Novidades
- Atletas por ordem alfabética.
- Escalões diferenciados visualmente por badge.
- Número do equipamento vermelho e branco na ficha do atleta.
- Convocatória com escolha de equipamento.
- Seleção manual dos convocados após sugestão automática.
- Visualização dos convocados num campo de futebol, com foto, nome e número correspondente ao equipamento escolhido.
- Botão PDF / Imprimir que abre uma folha A4 pronta para imprimir ou Guardar como PDF.
- Convocatória guardada na Google Sheet, incluindo equipamento e número usado.

## Atualização obrigatória do Apps Script
1. Substituir o Code.gs pelo desta versão.
2. Executar setup() uma vez. Isto faz a migração dos cabeçalhos existentes e acrescenta as novas colunas.
3. Implementar > Gerir implementações > Editar > Nova versão > Implementar.
4. Manter o mesmo URL /exec.

## GitHub
Substituir app.js, styles.css e sw.js pelos ficheiros desta versão. Os restantes podem ser carregados por cima sem problema.
