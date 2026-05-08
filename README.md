# Agenda de Home Office

Plataforma web para solicitação, aprovação e controle de home office de estagiários.

## Melhorias da versão atual

- Painel com KPIs adaptados por perfil: usuários veem a própria cota, adm/master veem a operação.
- Cartão de saldo mensal com cota, aprovados, pendentes e disponibilidade.
- Calendário mensal dos agendamentos filtrados, com navegação e agendamento por clique no dia.
- Bloqueio de solicitações em datas passadas e fins de semana.
- Cancelamento da própria solicitação pendente ou aprovada por qualquer perfil.
- Master pode alterar perfil de acesso e nível do usuário.
- Master pode cadastrar novos usuários direto no painel.
- Cada usuário acessa com senha/PIN de 4 dígitos; o PIN é salvo como hash SHA-256 no Firestore.
- Exportação CSV das aprovações pendentes.
- Dados sincronizados em tempo real no Cloud Firestore, sem salvar usuários/agendamentos no navegador.

## Regras de nível

- Nível 0: 0 agendamentos por mês
- Nível 1: 1 agendamento por mês
- Nível 2: 2 agendamentos por mês
- Nível 3: 4 agendamentos por mês

Os créditos são renovados todo mês e não acumulam para o mês seguinte.

## Cargos e permissões

- `usuario`: pode solicitar home office para si mesmo.
- `adm`: pode aprovar ou negar solicitações pendentes.
- `master`: pode aprovar/negar solicitações, alterar cargos (`upgrade/downgrade`), alterar nível e excluir usuários.

## Campos obrigatórios no cadastro

- Nome completo
- Cargo (função)
- Unidade de lotação
- Nível (0 a 3)
- Perfil de acesso (`usuario`, `adm`, `master`)

## Fluxo de uso

1. Execute `npm run dev`.
2. Abra [http://localhost:5173](http://localhost:5173).
3. Faça login pelo seletor de usuário.
4. Usuários criam solicitações na seção "Solicitar home office".
5. `adm` e `master` analisam solicitações pendentes (aprovar/negar).
6. `master` pode cadastrar usuários, alterar cargos e ajustar níveis na tabela de estagiários.

## Scripts

- `npm run dev`: sobe servidor local em `http://localhost:5173`.
- `npm run check`: valida a sintaxe do JavaScript.
- `npm run build`: placeholder para deploy estático.
- `npm run preview`: sobe servidor local em `http://localhost:5173`.

## Publicar no GitHub Pages

O projeto está pronto para rodar no GitHub Pages como site estático.

1. Crie um repositório no GitHub.
2. Suba estes arquivos para a branch `main`.
3. No GitHub, entre em `Settings > Pages`.
4. Em `Build and deployment`, selecione `GitHub Actions`.
5. Faça um push na `main`.
6. O workflow `.github/workflows/pages.yml` publica o site automaticamente.

Arquivos importantes para o GitHub:

- `.github/workflows/pages.yml`: deploy automático no GitHub Pages.
- `.nojekyll`: evita processamento Jekyll em site estático.
- `.gitignore`: impede subir `node_modules`, logs e arquivos locais.

Antes de publicar, rode:

```bash
npm run check
npm run build
```

## Alternativa sem npm

Se preferir, rode direto:

`python3 -m http.server 5173`

e abra [http://localhost:5173](http://localhost:5173).

## Fluxo antigo (abrir arquivo)

Também funciona abrindo `index.html` diretamente no navegador.

## Primeira execução

Na primeira vez, cadastre o primeiro usuário pelo formulário de primeiro acesso. Esse cadastro recebe automaticamente o cargo `master`.

## Senhas de acesso

- Cada pessoa precisa de um PIN de 4 dígitos para entrar.
- O primeiro cadastro cria o PIN do master.
- Master define o PIN inicial ao cadastrar novos usuários.
- Master pode redefinir o PIN pela tabela de estagiários usando o campo "Novo PIN" e clicando em "Salvar".
- Usuários antigos que ainda não tinham PIN são migrados automaticamente para o PIN padrão `0000`; redefina esses PINs depois pelo perfil master.

## Dados

Usuários e agendamentos são salvos no Cloud Firestore nas coleções:

- `estagiarios`
- `agendamentos`

O navegador guarda apenas dados de sessão, como usuário selecionado e tema, usando `sessionStorage`.

## Firebase

Para conectar o app ao Firebase:

1. Crie um projeto no Firebase.
2. Crie um app Web dentro do projeto.
3. Copie o objeto `firebaseConfig`.
4. Cole os valores em `firebase-config.js`.
5. Ative `Authentication > Sign-in method > Anonymous`.
6. Crie o Cloud Firestore.
7. Publique as regras de `firestore.rules`.

O app usa Firebase Auth anônimo só para liberar leitura/escrita no Firestore. Os perfis `usuario`, `adm` e `master` continuam sendo controlados pela própria plataforma.

Para produção com segurança forte, o próximo passo é trocar o seletor interno por login real do Firebase Auth e mover validações críticas de cota mensal para backend/Cloud Functions.
