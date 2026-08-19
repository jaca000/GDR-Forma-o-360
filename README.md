# GDR Formação 360 — v2

PWA mobile-first para gestão dos escalões de formação do GDR Faro do Alentejo.

## Alterações desta versão

- Logótipo oficial da Formação GDR integrado no login e cabeçalho.
- Login obrigatório por **Utilizador + PIN**.
- Perfis:
  - **Administrador** — acesso total.
  - **Treinador** — treinos, presenças, avaliações, consulta de atletas, dashboard e convocatórias.
- Apenas o **Administrador** pode:
  - adicionar atletas;
  - editar atletas;
  - eliminar/desativar atletas;
  - criar/editar/desativar utilizadores.
- O Treinador vê a lista de atletas mas não tem botões de gestão.
- Área de gestão de utilizadores exclusiva do Administrador.
- PWA com ícones gerados a partir do logótipo oficial.
- Backend `backend/Code.gs` já prepara folhas `USERS`, `ATHLETES`, `TRAININGS`, `RECORDS`, `GAMES` e `CALLUPS`.
- O backend já inclui base de autenticação com PIN guardado em SHA-256.

## Credenciais de demonstração

Enquanto `DEMO_MODE: true` em `config.js`:

- Administrador: `admin` / `1234`
- Treinador: `treinador` / `2468`

Estas credenciais são apenas para testar a interface. Na ligação definitiva ao Google Apps Script, os utilizadores passam a estar na Google Sheet.

## Atualizar no GitHub

Substituir os ficheiros atuais do repositório pelos ficheiros desta versão e carregar também as novas pastas:

- `assets/`
- `backend/`

O `index.html` continua na raiz do repositório.

## Nota de segurança

A versão publicada no GitHub ainda funciona em modo local/demo. A separação de permissões já está aplicada na interface, mas a segurança definitiva será feita no backend Apps Script, para que um utilizador não possa contornar permissões alterando JavaScript no browser.
