<h1 align="center">TrackFlow API</h1>

<p align="center">
  <strong>API REST SaaS multi-tenant para gestão de tempo, clientes, projetos, faturamento automatizado e assistência com Inteligência Artificial.</strong>
</p>

<p align="center">
  <img loading="lazy" src="https://img.shields.io/static/v1?label=STATUS&message=CONCLU%C3%8DDO&color=brightgreen&style=for-the-badge" alt="Status: Concluído" />
  <img loading="lazy" src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 20+" />
  <img loading="lazy" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img loading="lazy" src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 5" />
  <img loading="lazy" src="https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma 6" />
  <img loading="lazy" src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img loading="lazy" src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="Licença ISC" />
</p>

<p align="center">
  <a href="https://github.com/VictorHugoGutierrez/trackflow-api">
    <img loading="lazy" src="https://img.shields.io/github/stars/VictorHugoGutierrez/trackflow-api?style=social" alt="GitHub Stars" />
  </a>
</p>

---

# Índice

* [📖 Descrição do Projeto](#descricao-do-projeto)
* [📌 Status do Projeto](#status-do-projeto)
* [🔨 Funcionalidades e Demonstração da Aplicação](#funcionalidades-e-demonstracao)
* [📁 Acesso ao Projeto](#acesso-ao-projeto)
* [🛠️ Abrir e Rodar o Projeto](#abrir-e-rodar-o-projeto)
* [✔️ Técnicas e Tecnologias Utilizadas](#tecnologias-utilizadas)
* [🤝 Pessoas Contribuidoras](#pessoas-contribuidoras)
* [👨‍💻 Pessoas Desenvolvedoras do Projeto](#pessoas-desenvolvedoras)
* [📝 Licença](#licenca)

---

<a id="descricao-do-projeto"></a>
## 📖 Descrição do Projeto

A **TrackFlow API** é o backend REST em **Node.js + TypeScript** que alimenta a plataforma SaaS **TrackFlow**, projetada para equipes, consultorias e prestadores de serviço gerenciarem o ciclo completo de trabalho — do apontamento de horas em tempo real até o faturamento mensal com envio de documentos ao cliente.

Construída sobre uma arquitetura **multi-tenant** com isolamento rigoroso por organização (`tenantId`) e controle de acesso baseado em papéis (**RBAC**), a API unifica gestão de clientes, projetos com acompanhamento híbrido de orçamento (horas estimadas e teto financeiro), cronômetro em tempo real, relatórios exportáveis em CSV, geração de faturas em PDF, disparos transacionais de e-mail e recursos de Inteligência Artificial via **Ollama Cloud**.

### Arquitetura da Solução

```mermaid
flowchart LR
    Client["Frontend / Cliente HTTP"] --> API["Express 5 API (src/server.ts)"]
    API --> Auth["Auth / Tenant / RBAC Middlewares"]
    Auth --> Controllers["Controllers & Models"]
    Controllers --> DB[("PostgreSQL + Prisma ORM")]
    Controllers --> Google["Google OAuth 2.0"]
    Controllers --> Ollama["Ollama Cloud (IA)"]
    Controllers --> Resend["Resend (E-mails HTML)"]
    Controllers --> PDF["@react-pdf/renderer (PDF)"]
```

### Estrutura de Diretórios

```text
trackflow-api/
├── api/
│   └── index.ts          # Ponto de entrada serverless para a Vercel
├── prisma/
│   ├── migrations/       # Histórico de migrações PostgreSQL
│   ├── schema.prisma     # Modelagem relacional e enums (Tenant, User, Client, Project, TimeEntry, Invoice)
│   └── seed-admin.ts     # Script de provisionamento do usuário SUPER_ADMIN
├── src/
│   ├── controllers/      # Regras de entrada/saída HTTP por domínio
│   ├── errors/           # Classe AppError para padronização de erros de negócio
│   ├── lib/              # Clientes e integrações (Prisma, Ollama Cloud, Resend)
│   ├── middlewares/      # Autenticação JWT/Cookie, isolamento de tenant e RBAC
│   ├── models/           # Camada de acesso a dados e agregações via Prisma
│   ├── routes/           # Definição modular das rotas REST
│   ├── services/         # Templates HTML de e-mail e renderização de PDFs
│   ├── types/            # Definições de tipos TypeScript (Express e contratos da API)
│   ├── utils/            # Utilitários de formatação monetária e temporal
│   └── server.ts         # Configuração do Express, CORS, rotas e error handler global
├── .env.example          # Modelo de variáveis de ambiente
├── package.json          # Dependências e scripts do projeto
├── tsconfig.json         # Configuração do compilador TypeScript
└── vercel.json           # Rewrites e empacotamento para deploy na Vercel
```

---

<a id="status-do-projeto"></a>
## 📌 Status do Projeto

<h4 align="center">
  ✅ Projeto concluído e em produção ✅
</h4>

A API encontra-se implantada na **Vercel** em [`https://trackflow-api-production.vercel.app/`](https://trackflow-api-production.vercel.app/), atendendo em produção a aplicação web oficial em [`https://app-trackflow.vercel.app/`](https://app-trackflow.vercel.app/).

---

<a id="funcionalidades-e-demonstracao"></a>
## 🔨 Funcionalidades e Demonstração da Aplicação

- `Arquitetura SaaS Multi-tenant & RBAC`: isolamento lógico de dados por `tenantId` por meio de middlewares dedicados (`authMiddleware`, `requireTenant`, `requireRole` e `superAdminMiddleware`), com suporte a quatro níveis de acesso (`SUPER_ADMIN`, `OWNER`, `MANAGER` e `MEMBER`) e bloqueio automático de workspaces suspensos.
- `Autenticação Segura & Controle de Sessão`: cadastro com criação automática de workspace (`OWNER`), login tradicional com `bcryptjs` + JWT (via cookie `HttpOnly` `trackflow_session` ou cabeçalho `Authorization: Bearer`), login social via **Google OAuth 2.0**, troca obrigatória de senha no primeiro acesso (`mustChangePassword`) e recuperação de senha por e-mail.
- `Perfil, Preferências e Pomodoro`: gerenciamento individual de perfil, valor-hora padrão em centavos, moeda (`BRL`), tema (`dark`/`light`) e duração dos ciclos de trabalho e pausa do Pomodoro.
- `Gestão de Clientes e Projetos com Orçamento Híbrido`: CRUD completo de clientes (com desativação lógica) e projetos com monitoramento simultâneo de horas estimadas (`estimatedSeconds`) e orçamento financeiro (`budgetCents`), atualizando automaticamente o status do projeto para `OVER_BUDGET` quando qualquer limite é atingido.
- `Apontamento de Horas (Cronômetro & Manual)`: início e parada de cronômetro em tempo real (encerrando automaticamente eventuais cronômetros ativos anteriores), lançamentos manuais retroativos, bloqueio de registros em projetos concluídos (`COMPLETED`) e cálculo financeiro preciso em números inteiros (centavos e segundos).
- `Gestão de Equipe`: convite de gestores (`MANAGER`) e colaboradores (`MEMBER`) com envio automático de senha temporária por e-mail, edição de papéis e valor-hora, histórico de atividades por membro e remoção da equipe.
- `Faturamento, PDF, E-mails e Relatórios CSV`: consolidação de apontamentos faturáveis em faturas mensais, geração de PDF A4 estilizado via `@react-pdf/renderer`, envio de e-mails transacionais em HTML via **Resend** (boas-vindas, convite de equipe, provisionamento de tenant, recuperação de senha, alteração de senha e envio de fatura) e exportação de relatórios em CSV.
- `Inteligência Artificial (Ollama Cloud)`: assistente de chat contextualizado com os projetos ativos e apontamentos recentes do workspace (`POST /api/ai/chat`) e geração de resumos executivos de entregas para relatórios e faturas (`POST /api/reports/ai-insight`).
- `Painel Control Plane (Super Admin)`: visão global do SaaS com métricas de tenants ativos e suspensos, total de usuários, horas rastreadas por período, cálculo de MRR para os planos `freemium`, `pro` e `enterprise`, provisionamento/gestão de organizações e logs de saúde das integrações (Ollama Cloud e Resend).

### Visão Geral dos Endpoints REST

#### Health Check

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/ping` / `/api/ping` | Público | Verifica se a API está online e retorna o timestamp atual |

#### Autenticação & Perfil

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Público | Registra novo usuário `OWNER` e cria seu workspace inicial |
| `POST` | `/api/auth/login` | Público | Autentica por e-mail/senha e emite sessão JWT |
| `POST` | `/api/auth/google` | Público | Autentica via Google OAuth 2.0 (`idToken` ou `accessToken`) |
| `POST` | `/api/auth/forgot-password` | Público | Gera senha temporária e envia e-mail de recuperação |
| `POST` | `/api/auth/logout` | Público | Encerra a sessão limpando o cookie `trackflow_session` |
| `GET` | `/api/auth/me` | Autenticado | Retorna os dados da sessão, workspace e configurações |
| `PATCH` | `/api/auth/change-password` | Autenticado | Atualiza a senha e renova o token de sessão |
| `PATCH` | `/api/auth/first-access` | Autenticado | Conclui a troca obrigatória de senha do primeiro acesso |
| `PATCH` | `/api/auth/profile` *(alias `/api/users/profile`)* | Autenticado | Atualiza dados do perfil do usuário autenticado |
| `PATCH` | `/api/auth/settings` *(alias `/api/users/settings`)* | Autenticado | Atualiza valor-hora, moeda, tema e intervalos do Pomodoro |

#### Clientes & Projetos *(requerem workspace/tenant)*

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/clients` | Autenticado + Tenant | Cadastra um novo cliente no workspace |
| `GET` | `/api/clients` | Autenticado + Tenant | Lista clientes ativos do workspace |
| `PATCH` | `/api/clients/:id` | Autenticado + Tenant | Atualiza nome, contato ou status ativo do cliente |
| `DELETE` | `/api/clients/:id` | Autenticado + Tenant | Desativa logicamente um cliente |
| `POST` | `/api/projects` | Autenticado + Tenant | Cria projeto com orçamento em reais/centavos e horas estimadas |
| `GET` | `/api/projects` | Autenticado + Tenant | Lista projetos ativos e calcula consumo híbrido de orçamento |
| `PATCH` | `/api/projects/:id` | Autenticado + Tenant | Atualiza dados e metas de orçamento do projeto |
| `PATCH` | `/api/projects/:id/status` | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Altera o status do projeto (`ACTIVE`, `COMPLETED`, `OVER_BUDGET`) |
| `DELETE` | `/api/projects/:id` | Autenticado + Tenant | Desativa logicamente um projeto |

#### Apontamentos de Tempo *(requerem workspace/tenant)*

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/time-entries/start` | Autenticado + Tenant | Inicia novo cronômetro (encerrando eventual cronômetro ativo) |
| `PATCH` | `/api/time-entries/:id/stop` | Autenticado + Tenant | Para o cronômetro e calcula duração e valor em centavos |
| `GET` | `/api/time-entries/active` | Autenticado + Tenant | Consulta o apontamento em andamento do usuário |
| `GET` | `/api/time-entries` | Autenticado + Tenant | Lista apontamentos com filtros por período, projeto e membro |
| `POST` | `/api/time-entries` | Autenticado + Tenant | Cria apontamento manual com início e fim informados |
| `PATCH` | `/api/time-entries/:id` | Autenticado + Tenant | Edita descrição, projeto, faturabilidade ou horários |
| `DELETE` | `/api/time-entries/:id` | Autenticado + Tenant | Remove um apontamento de tempo |

#### Gestão de Equipe *(requerem workspace/tenant)*

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/team` | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Lista os membros do workspace |
| `POST` | `/api/team/invite` *(alias `/api/team`)* | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Convida membro (`MANAGER` ou `MEMBER`) com e-mail de boas-vindas |
| `PATCH` | `/api/team/:id` | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Atualiza papel, status ou valor-hora do membro |
| `GET` | `/api/team/:id/activity` | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Consulta histórico recente de atividades do membro |
| `DELETE` | `/api/team/:id` | `OWNER`, `MANAGER`, `SUPER_ADMIN` | Remove ou desativa membro da equipe |

#### Relatórios, Faturamento & IA *(requerem workspace/tenant)*

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/reports/export/csv` | `OWNER`, `MANAGER`, `MEMBER` | Exporta relatório detalhado de apontamentos em formato CSV |
| `GET` | `/api/reports/summary` | `OWNER`, `MANAGER` | Consolida resumo financeiro e de horas por filtros |
| `POST` | `/api/reports/ai-insight` *(alias `/api/reports/ai-summary`)* | `OWNER`, `MANAGER` | Gera resumo executivo das entregas utilizando Ollama Cloud |
| `GET` | `/api/invoices` | `OWNER`, `MANAGER` | Lista as faturas geradas pelo workspace |
| `POST` | `/api/invoices/generate` *(alias `/api/invoices`)* | `OWNER`, `MANAGER` | Gera fatura mensal vinculando os apontamentos faturáveis |
| `GET` | `/api/invoices/:id/pdf` | `OWNER`, `MANAGER` | Renderiza e retorna o PDF A4 da fatura |
| `POST` | `/api/invoices/:id/send` | `OWNER`, `MANAGER` | Envia a fatura formatada por e-mail via Resend |
| `PATCH` | `/api/invoices/:id/status` | `OWNER`, `MANAGER` | Atualiza o status da fatura (`pendente`, `pago`, `cancelado`) |
| `POST` | `/api/ai/chat` | Autenticado + Tenant | Conversa com o assistente de IA contextualizado ao workspace |

#### Administração Global *(Control Plane — requer `SUPER_ADMIN` sem `tenantId`)*

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/admin/metrics` | `SUPER_ADMIN` | Métricas globais do SaaS, distribuição de planos e MRR |
| `GET` | `/api/admin/tenants` | `SUPER_ADMIN` | Lista workspaces com paginação e filtros |
| `POST` | `/api/admin/tenants` | `SUPER_ADMIN` | Provisiona novo workspace e usuário `OWNER` com envio de e-mail |
| `GET` | `/api/admin/tenants/:id` | `SUPER_ADMIN` | Detalha dados e estatísticas de um workspace específico |
| `PATCH` | `/api/admin/tenants/:id` | `SUPER_ADMIN` | Atualiza nome, plano ou status ativo/suspenso do workspace |
| `DELETE` | `/api/admin/tenants/:id` | `SUPER_ADMIN` | Remove um workspace e seus registros vinculados |
| `GET` | `/api/admin/logs` | `SUPER_ADMIN` | Monitora saúde do Ollama Cloud e eventos recentes do Resend |

### Demonstração de Requisição & Padrão de Resposta

As rotas protegidas aceitam autenticação via cookie `HttpOnly` (`trackflow_session`) ou cabeçalho `Authorization: Bearer <jwt>`. Todas as respostas seguem um envelope JSON padronizado:

```bash
curl -s https://trackflow-api-production.vercel.app/api/ping
```

**Resposta de sucesso (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "status": "online",
    "timestamp": "2026-11-25T23:30:00.000Z"
  }
}
```

**Resposta de erro padronizada (`AppError` / Prisma):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível do erro ocorrido."
  }
}
```

---

<a id="acesso-ao-projeto"></a>
## 📁 Acesso ao Projeto

Você pode acessar a aplicação em produção, consumir a API diretamente ou baixar o código-fonte completo pelo GitHub:

- **API em Produção (Vercel):** [`https://trackflow-api-production.vercel.app/`](https://trackflow-api-production.vercel.app/)
- **Aplicação Web (Frontend):** [`https://app-trackflow.vercel.app/`](https://app-trackflow.vercel.app/)
- **Repositório no GitHub:** [`https://github.com/VictorHugoGutierrez/trackflow-api`](https://github.com/VictorHugoGutierrez/trackflow-api)

Para clonar o repositório localmente:

```bash
git clone https://github.com/VictorHugoGutierrez/trackflow-api.git
```

---

<a id="abrir-e-rodar-o-projeto"></a>
## 🛠️ Abrir e Rodar o Projeto

### Pré-requisitos

Antes de começar, certifique-se de ter instalado e configurado:

- **Node.js** `20+` (desenvolvido e validado em Node `24`) e **npm**
- Banco de dados **PostgreSQL** (ex.: [Neon](https://neon.tech/) ou instância local)

### Passo a Passo para Execução Local

1. **Acesse a pasta do projeto:**

   ```bash
   cd trackflow-api
   ```

2. **Instale as dependências:**
   *(O script `postinstall` executará `prisma generate` automaticamente.)*

   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Copie o arquivo de exemplo e preencha os valores do seu ambiente:

   ```bash
   cp .env.example .env
   ```

   | Variável | Obrigatória | Padrão / Exemplo | Descrição |
   | --- | --- | --- | --- |
   | `PORT` | Não | `3333` | Porta HTTP local da API |
   | `NODE_ENV` | Não | `development` | Ambiente de execução (`development` / `production`) |
   | `FRONTEND_URL` | Sim | `http://localhost:3000` | Origem permitida no CORS e base para links em e-mails |
   | `DATABASE_URL` | Sim | `postgresql://USER:PASSWORD@HOST/trackflow?sslmode=require` | String de conexão PostgreSQL para o Prisma |
   | `JWT_SECRET` | Sim | `defina_uma_chave_secreta_longa_aqui` | Segredo de assinatura do JWT e cookies (mín. 32 caracteres) |
   | `COOKIE_DOMAIN` | Não | `localhost` | Domínio de escopo do cookie de sessão |
   | `GOOGLE_CLIENT_ID` | Condicional | `seu-google-client-id.apps.googleusercontent.com` | Client ID OAuth 2.0 para login com Google |
   | `OLLAMA_API_URL` | Não | `https://ollama.com` | Host da API do Ollama Cloud |
   | `OLLAMA_API_KEY` | Condicional | `""` | Chave de API para recursos de IA (chat e resumo de entregas) |
   | `OLLAMA_API_MODEL` | Não | `gemma4:31b-cloud` | Modelo de linguagem utilizado no Ollama Cloud |
   | `RESEND_API_KEY` | Condicional | `re_123456789` | Chave da API Resend para envio de e-mails transacionais |
   | `RESEND_FROM_EMAIL` | Não | `onboarding@resend.dev` | Remetente verificado utilizado nos disparos via Resend |
   | `ADMIN_EMAIL` | Não | `admin@trackflow.com` | E-mail utilizado ao executar o seed de `SUPER_ADMIN` |
   | `ADMIN_PASSWORD` | Não | `Admin@123456` | Senha inicial definida pelo script de seed do `SUPER_ADMIN` |

4. **Execute as migrações do banco de dados:**

   ```bash
   npx prisma migrate dev
   ```

   > Em ambientes de produção/CI, utilize `npx prisma migrate deploy`.

5. **(Opcional) Crie ou atualize o usuário `SUPER_ADMIN`:**

   ```bash
   npm run seed:admin
   ```

6. **Inicie o servidor em modo de desenvolvimento:**

   ```bash
   npm run dev
   ```

   A API ficará disponível em `http://localhost:3333` (teste com `GET http://localhost:3333/api/ping`).

7. **Gerar build de produção (TypeScript -> `dist/`):**

   ```bash
   npm run build
   ```

### Deploy Serverless na Vercel

O projeto já está preparado para hospedagem serverless na **Vercel**:
- [vercel.json](vercel.json) redireciona todas as requisições HTTP para o entrypoint serverless em [api/index.ts](api/index.ts), que exporta a instância `app` configurada em [src/server.ts](src/server.ts).
- [prisma/schema.prisma](prisma/schema.prisma) define `binaryTargets = ["native", "rhel-openssl-3.0.x"]` para garantir compatibilidade com o runtime da Vercel.

---

<a id="tecnologias-utilizadas"></a>
## ✔️ Técnicas e Tecnologias Utilizadas

- **Runtime & Linguagem:** `Node.js`, `TypeScript 5.9`, `tsx`
- **Framework Web & HTTP:** `Express 5`, `cors`, `cookie-parser`, `dotenv`, `EJS`
- **Banco de Dados & ORM:** `PostgreSQL (Neon)`, `Prisma ORM 6`
- **Autenticação & Segurança:** `jsonwebtoken`, `bcryptjs`, `google-auth-library` (Google OAuth 2.0)
- **IA, E-mails & Documentos:** `ollama` (Ollama Cloud SDK), `resend`, `@react-pdf/renderer`, `React 19`
- **Infraestrutura & Deploy:** `Vercel Serverless Functions`
- **Técnicas de Engenharia Aplicadas:**
  - Arquitetura **Multi-tenant** com isolamento por organização e bloqueio de workspaces suspensos;
  - Controle de acesso **RBAC** granular por rota e papel (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `MEMBER`);
  - Precisão financeira e temporal utilizando **números inteiros** (`amountCents`, `hourlyRateCents`, `budgetCents` e `durationSeconds`) para evitar erros de ponto flutuante;
  - Tratamento centralizado de exceções com classe customizada `AppError` e mapeamento de erros conhecidos do Prisma (`P2002` e `P2025`).

---

<a id="pessoas-contribuidoras"></a>
## 🤝 Pessoas Contribuidoras

Contribuições são muito bem-vindas! Para colaborar com melhorias ou correções:

1. Faça um **Fork** deste repositório.
2. Crie uma nova branch para sua alteração:
   ```bash
   git checkout -b feat/minha-melhoria
   ```
3. Faça o commit das suas alterações:
   ```bash
   git commit -m "feat: descreve a melhoria implementada"
   ```
4. Envie para o seu repositório remoto (`git push origin feat/minha-melhoria`).
5. Abra um **Pull Request** descrevendo claramente o contexto e as mudanças realizadas.

---

<a id="pessoas-desenvolvedoras"></a>
## 👨‍💻 Pessoas Desenvolvedoras do Projeto

| [<img loading="lazy" src="https://avatars.githubusercontent.com/u/105084189?v=4" width=115><br><sub>Victor Hugo Gutierrez</sub>](https://github.com/VictorHugoGutierrez) | [<img loading="lazy" src="https://avatars.githubusercontent.com/u/207619710?v=4" width=115><br><sub>João Cerri</sub>](https://github.com/joaocerri) |
| :---: | :---: |

---

<a id="licenca"></a>
## 📝 Licença

Este projeto está licenciado sob a licença **ISC**, conforme especificado em [`package.json`](package.json).
