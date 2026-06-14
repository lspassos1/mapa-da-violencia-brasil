# Provedores de IA (free tier) — camada OSINT

Estes provedores alimentam a **extração de notícias** da camada OSINT (ler uma
matéria → JSON estruturado: tipo de crime, município/UF, vítimas, confiança).

## ⚠️ Segurança — leia primeiro

- As chaves vivem **apenas** em `.env.local` (ignorado pelo git) e/ou nas
  *Environment Variables* da Vercel. **Nunca** são commitadas.
- **Sem prefixo `NEXT_PUBLIC_`**: estas variáveis são segredos de servidor. Com
  esse prefixo o Next.js as embute no bundle do navegador e elas vazam. Use-as
  só em `src/app/api/*` ou server actions — nunca em código de cliente.
- As chaves atuais foram coladas no chat durante a configuração; em ambiente
  sensível, **rotacione-as** no painel de cada provedor.

## Variáveis de ambiente

| Variável | Provedor | Observação |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini | **Recomendado.** Melhor free tier, ótimo PT, JSON nativo. |
| `GEMINI_PROJECT_NUMBER` | Google Gemini | Informativo (auth é pela API key). |
| `GROQ_API_KEY` | Groq | Llama/Mixtral, muito rápido. |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI | Precisa também de `CLOUDFLARE_ACCOUNT_ID`. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI | Obrigatório no path do endpoint (preencher). |
| `OPENROUTER_API_KEY` | OpenRouter | Agregador; há modelos `:free`. |
| `MISTRAL_API_KEY` | Mistral La Plateforme | Tier experimental. |
| `TOGETHER_API_KEY` | Together AI | Também já configurada direto na Vercel. |

## Endpoints e modelos (referência rápida)

Todos compatíveis com `fetch` a partir de uma rota de servidor. Os três
primeiros (OpenRouter, Groq, Together) usam o formato **OpenAI-compatible**
(`POST /chat/completions`), o que facilita trocar de provedor mudando só a URL,
o header e o nome do modelo.

| Provedor | Endpoint | Modelo barato/grátis sugerido | Header de auth |
|---|---|---|---|
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=$GEMINI_API_KEY` | `gemini-2.0-flash` | key na query string |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `llama-3.3-70b-versatile` | `Authorization: Bearer $GROQ_API_KEY` |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | modelos com sufixo `:free` | `Authorization: Bearer $OPENROUTER_API_KEY` |
| Together | `https://api.together.xyz/v1/chat/completions` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | `Authorization: Bearer $TOGETHER_API_KEY` |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | `mistral-small-latest` | `Authorization: Bearer $MISTRAL_API_KEY` |
| Cloudflare | `https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/<model>` | `@cf/meta/llama-3.1-8b-instruct` | `Authorization: Bearer $CLOUDFLARE_API_TOKEN` |

> Os IDs de modelo e os limites de free tier mudam com frequência — confirme no
> painel de cada provedor antes de fixar em produção.

## Estratégia recomendada

1. **Gemini Flash como principal** (melhor qualidade grátis para PT + JSON).
2. **Fallback em cascata** quando o principal estiver sem cota (HTTP 429):
   Gemini → Groq → OpenRouter → Together. Como 3 deles falam o protocolo
   OpenAI, o fallback é quase só trocar URL + header + modelo.
3. Manter o campo `confidence` da extração: casos abaixo de um limiar vão para
   revisão humana, compensando a precisão menor dos modelos grátis.

> **Saúde das chaves:** rode `npm run check:ai-keys` (script
> `scripts/check_ai_keys.mjs`) para validar quais chaves estão ativas — ele lê
> de `.env.local` e nunca imprime os valores.
