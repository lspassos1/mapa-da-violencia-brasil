# Spec — Radar de tiroteios georreferenciados (near-real-time)

Status: **proposta / a implementar** (este doc detalha o que precisa ser feito; a implementação vem no "PR do radar"). Parte do épico #7, ao lado das lentes do `/radar` (#85).

## 1. Objetivo

Uma página `/radar/tiroteios` que mostra, num mapa, os **tiroteios georreferenciados mais recentes** (fonte: Fogo Cruzado), atualizada **periodicamente** (não a cada request) para **respeitar o limite da API**, com **contexto analítico** que os apps existentes não dão: classificação do evento (disputa entre grupos × ação policial × controle), corroboração com a camada **OSINT** de notícias, e a moldura de anomalia do projeto.

**Não-objetivo:** virar um app de alerta cidadão em tempo real (raio de 5 km, push). Isso o Fogo Cruzado e o OTT já fazem bem — não vamos competir nem incentivar pânico. O nosso valor é **análise**, não alarme.

## 2. O que já existe (análise)

| Projeto | Modelo | Forte | Lacuna (nossa oportunidade) |
|---|---|---|---|
| **Fogo Cruzado** ([app](https://apps.apple.com/br/app/fogo-cruzado/id1131097214), [api](https://api.fogocruzado.org.br/docs)) | colaborativo **verificado** + API; RJ/Recife/BA/PA | mapa em tempo real, alerta por raio/região, dado limpo (é a nossa fonte) | mostra o **evento**, não o **padrão**: sem classificação de contexto agregada, sem cruzamento com notícia, sem leitura de anomalia |
| **Onde Tem Tiroteio (OTT)** ([techtudo](https://www.techtudo.com.br/dicas-e-tutoriais/2019/01/app-ott-mostra-onde-tem-tiroteio-em-tempo-real-pelo-celular-saiba-usar.ghtml)) | C2C colaborativo, ~90 verificadores, 24/7, alcança 4,7M | velocidade, alcance social, foco em proteção imediata | foco em alerta individual; pouca análise histórica/estrutural |
| **ShotSpotter / SoundThinking** ([site](https://www.soundthinking.com/law-enforcement/leading-gunshot-detection-system/)) | sensores acústicos, **só polícia** | precisão (localização + nº de tiros), replay temporal | fechado, hardware, não-público, controverso |
| **Citizen** ([app](https://apps.apple.com/us/app/citizen-protect-the-world/id1039889567)) | alertas 911 + vídeo ao vivo + mapa | UX de incidente ao vivo, proximidade | EUA; sensacionalismo; sem análise estrutural |

**Conclusão:** o nicho livre é o **radar analítico** — pegar o dado verificado (Fogo Cruzado), sobrepor **contexto e padrão** (disputa/controle, corroboração OSINT, anomalia) e manter **metodologia aberta**. Improvements concretos sobre os existentes: (a) classificar cada zona (disputa × controle), (b) cruzar tiroteio ↔ notícia OSINT do mesmo fato, (c) marcar o que é atípico, (d) ser transparente e não-alarmista.

## 3. Arquitetura proposta (respeita o limite da API)

```
Vercel Cron (a cada X min)  ──>  /api/shootings/refresh  ──>  Fogo Cruzado API (janela recente)
        │                              │
        │                              └─> upsert no Supabase (tabela shooting_occurrences)  [reusa infra do #91]
        ▼
/api/shootings (GET)  <── lê do cache/banco (NUNCA chama a FC API por request)
        ▼
/radar/tiroteios (página, MapLibre)  ── marcadores por contexto + popup + cross-ref OSINT
```

- **Atualização periódica, não por request:** um cron (`vercel.json`, ex. a cada 15 min — Hobby é diário, então no Hobby cai p/ 1×/dia, ou usar um cron externo/Upstash) puxa só a **janela recente** (ex. últimas 48h) e dá upsert. O GET público lê do banco/cache → o limite da FC é consumido por **1 job**, não por N usuários. (Mesmo padrão do `/api/news-incidents`.)
- **Token FC server-only**, renovado pelo job (expira em 3600s). Credenciais em env (`FOGO_CRUZADO_*`), nunca no cliente.
- **Cache/single-flight** no GET (igual à camada OSINT) como segunda barreira.
- **Persistência** reaproveita o que o #91 montou (Supabase + cron + upsert idempotente por `id` da ocorrência FC).

## 4. O que precisa ser feito (checklist)

- [ ] Tabela `shooting_occurrences` (Supabase, via MCP): id FC, data, lat/lng, município, bairro, mainReason, policeAction, mortos, feridos, `first_seen_at`. RLS leitura pública. (espelha `news_incidents`).
- [ ] `src/server/shootings/fogocruzado.ts` (server-only): cliente FC (login+refresh token, fetch janela recente, mapear ocorrência → row).
- [ ] `/api/shootings/refresh` (POST/GET, protegido por `CRON_SECRET`): puxa janela recente da FC → upsert. + entrada no `vercel.json`.
- [ ] `/api/shootings` (GET): lê do banco (janela N dias), filtros (`?reason=`, `?city=`, `?dias=`), degradação graciosa sem credenciais.
- [ ] Página `/radar/tiroteios` (MapLibre, reusa `NewsMap`): marcadores por **contexto** (disputa=vermelho, polícia=azul, outro=âmbar), popup (data, local, mortos/feridos, motivo, link), stats.
- [ ] **Cross-ref OSINT:** quando um incidente de notícia (news_incidents) casar com um tiroteio (mesmo município + janela temporal), mostrar o link da notícia no popup.
- [ ] Camada de classificação por zona reusando a **lente 2** (`criminalGovernance.ts`): pintar municípios "controle" × "disputa".
- [ ] Testes (mapeamento FC→row, filtros, dedupe idempotente) + verificação no browser.
- [ ] Guardrails na UI: "indício/registro, fonte Fogo Cruzado, não é alerta de emergência" + link à metodologia.

## 5. Guardrails

- **Não é alerta de emergência** — deixar explícito (não substitui 190/FC/OTT). Sem push/pânico.
- **Sempre com fonte e data** (Fogo Cruzado), respeitando a licença aberta deles.
- **Cobertura = a do Fogo Cruzado** (RJ, Recife, BA, PA) — declarar.
- **Privacidade:** nível de bairro/município, sem expor indivíduos.

## 6. Dependências / notas
- Reusa: infra de persistência+cron do #91, `NewsMap`, a lente 2 (`criminalGovernance.ts`), e o que já temos do Fogo Cruzado (`scripts/build_rj_shootings.mjs`).
- Cron sub-diário precisa de Pro (Hobby = diário) — alternativa: agendador externo (Upstash/GitHub Actions) chamando `/api/shootings/refresh` com o `CRON_SECRET`.
