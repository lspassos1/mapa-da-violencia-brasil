# 🎯 Mapa da Violência Brasil

[![Ao vivo](https://img.shields.io/badge/▶_ao_vivo-radar_de_tiroteios-22d3ee?style=flat)](https://mapa-da-violencia-brasil.vercel.app)
[![Licença](https://img.shields.io/github/license/lspassos1/mapa-da-violencia-brasil?style=flat&color=blue)](LICENSE)
[![Último commit](https://img.shields.io/github/last-commit/lspassos1/mapa-da-violencia-brasil?style=flat)](https://github.com/lspassos1/mapa-da-violencia-brasil/commits)
[![Stars](https://img.shields.io/github/stars/lspassos1/mapa-da-violencia-brasil?style=social)](https://github.com/lspassos1/mapa-da-violencia-brasil/stargazers)

[![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-396CB2?style=flat&logo=maplibre&logoColor=white)](https://maplibre.org)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-000?style=flat&logo=vercel&logoColor=white)](https://vercel.com)

> Radar da violência no Brasil em uma só aplicação: **tiroteios em tempo quase real**, o **mapa oficial** dos homicídios e um **radar de anomalia** que aponta onde a estatística oficial pode não ser confiável — sempre separando **indício** de **estatística oficial**.

**▶ Ao vivo:** <https://mapa-da-violencia-brasil.vercel.app>

---

## ✦ O que é

Três camadas, com **fidelidades diferentes** e **nunca misturadas** (cada indício carrega fonte e ressalva):

### 1. Radar de tiroteios — _a home_, tempo quase real
- Tiroteios/disparos **georreferenciados** do **Fogo Cruzado** (regiões metropolitanas de Rio de Janeiro, Recife, Salvador e Belém).
- **Camada OSINT nacional:** indícios de violência armada extraídos de **notícias** por IA, cobrindo cidades **fora** das 4 metros (precisão municipal — indício, não registro).
- **"📍 Perto de mim"**, classificação de contexto (disputa entre grupos × ação policial), tendência histórica acumulada.
- ⚠️ **Não é alerta de emergência** — em urgências, ligue **190**.

### 2. Mapa oficial — dado agregado
- Homicídio doloso por município (**SINESP/MJSP — Base VDE**): score 0–100, comparação entre estados e tendências/sazonalidade.

![Mapa oficial — Mapa da Violência Brasil](docs/assets/mvp-screenshot.jpg)

### 3. Radar de anomalia / credibilidade do dado oficial
Detecta **onde a violência reportada pode estar suprimida** — fundamentado em literatura. Indício, **nunca acusação**.
- **Lente 1 · ciclo eleitoral** — queda atípica do homicídio na janela pré-eleitoral, comparada **por pares** de mesmo porte (diff-in-diff, nunca ranking cru) e **cruzada com presença de facção**.
- **Lente 2 · governança criminal (RJ)** — controle territorial × disputa (Fogo Cruzado + ISP-RJ).
- **Lente 3 · homicídios ocultos** — homicídio caindo enquanto a "morte por causa indeterminada" (MVCI) sobe **acima da tendência nacional** (SIM/DATASUS).
- **Digest semanal por IA** — boletim sóbrio, apartidário, com fontes e moldura de indício.

> **Moldura inegociável:** indício para investigar, **nunca acusação**; **apartidário**; sempre com a fonte.

---

## ✦ Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · MapLibre GL JS · lucide-react |
| **Backend / dados** | Next API Routes (`server-only`) · Supabase (Postgres + RPC) · assets JSON versionados |
| **IA / OSINT** | Rodízio de provedores grátis (Gemini · Groq · Cloudflare · Mistral · OpenRouter · Together) · classificação **keyword-first** · **geocode por dicionário** (IBGE, sem LLM) · dedupe determinístico sem embeddings |
| **Infra** | Vercel (deploy + cron) · GitHub Actions (cron de ingestão) · Supabase (sa-east-1) |
| **Qualidade** | ESLint · `node:test` (contratos/API) · Playwright · Greptile · Snyk · Dependabot |

---

## ✦ Fontes de dados

| Fonte | Uso |
|---|---|
| **Fogo Cruzado** (API v2) | Tiroteios georreferenciados (4 regiões metropolitanas) |
| **SINESP/MJSP** (Base VDE) | Homicídio doloso oficial por município/UF |
| **ISP-RJ / ISPdados** | Criminalidade municipal do Rio de Janeiro |
| **SIM/DATASUS** | Mortalidade — homicídio (X85–Y09) × MVCI (Y10–Y34) |
| **IBGE** | Municípios e centroides (geocoding) |
| **Google Notícias** (RSS) | Matéria-prima da camada OSINT |
| **Ministério da Justiça** (Mapa das Orcrim) | Presença de facção por UF (cross-gating) |

---

## ✦ Rodando localmente

Requer **Node.js 22.x** e **npm ≥ 10** (a major fica em `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # preencha as credenciais — nenhum segredo é versionado
npm run dev                  # http://localhost:3000
```

Scripts úteis:

```bash
npm run validate   # lint + typecheck + testes + build (o que o CI roda)
npm run test       # testes de contrato e de API (node:test)
npm run build      # build de produção
```

> 🔒 **Segurança:** este repositório **não versiona segredos**. As variáveis de ambiente (Supabase, provedores de IA, Fogo Cruzado, etc.) ficam apenas no seu `.env.local` e nos secrets do deploy.

---

## ✦ Licença e direitos de uso

Distribuído sob **[GNU AGPL-3.0](LICENSE)**. Em resumo:

| Uso | Permitido? | Observação |
|---|:---:|---|
| Pessoal · pesquisa · educação | ✅ | sob AGPL-3.0 |
| Self-hosted (sua própria instância) | ✅ | sob AGPL-3.0 |
| Fork e modificar | ✅ | publique o código modificado sob AGPL-3.0 |
| Uso em rede / SaaS | ✅ | a AGPL exige **disponibilizar o código-fonte** aos usuários do serviço |

> A AGPL-3.0 é uma licença _copyleft_ de rede: se você roda uma versão modificada acessível por rede, precisa oferecer o código-fonte correspondente aos usuários.

---

## ✦ Aviso

Esta aplicação **não é alerta de emergência** (em urgências, **190**) e **não mede risco individual em tempo real**. As camadas de notícias/anomalia são **indícios**, não estatística oficial nem prova; não devem ser usadas para vigilância, previsão de crime ou conclusões sobre eventos ou pessoas específicas. Dados oficiais podem ter subnotificação, revisões e diferenças metodológicas entre fontes.
