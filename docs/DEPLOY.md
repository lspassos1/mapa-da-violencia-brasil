# Deploy Demo na Vercel

Este documento descreve o deploy demo do Mapa da Violencia Brasil na Vercel.

Status desta fase: deploy publico concluido. Nenhuma integracao com SINESP, IBGE, Supabase, PostGIS ou vector tiles foi feita nesta etapa.

## URLs

- Demo publica: https://mapa-da-violencia-brasil.vercel.app
- Painel Vercel: https://vercel.com/lspassos1s-projects/mapa-da-violencia-brasil

## Vercel

1. Acesse a Vercel.
2. Importe o repositorio GitHub `lspassos1/mapa-da-violencia-brasil`.
3. Selecione o framework `Next.js`.
4. Use a branch de producao `main`.
5. Use os comandos:

```txt
Install Command: npm install
Build Command: npm run build
Output Directory: padrao do Next.js
```

Nao e necessario adicionar `vercel.json` nesta fase: a Vercel detecta Next.js automaticamente.

Runtime esperado:

```txt
Node.js: 22.x
Python CI/ETL: 3.12
```

## Variaveis de ambiente

Nenhuma variavel de ambiente e obrigatoria para manter o deploy em modo
demonstrativo/mock.

A variavel efetiva para publicar a amostra oficial e:

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample
```

Valores e comportamento:

- Ausente ou vazio: o app permanece no fallback demonstrativo (`demo`).
- `official_sample`: o app usa a amostra oficial versionada.
- `demo`: fallback demonstrativo explicito.
- Qualquer outro valor (incluindo o legado `mock`): recai em `demo` e
  emite um aviso no console para sinalizar configuracao incorreta.

Use apenas `NEXT_PUBLIC_CRIME_DATA_MODE`. O nome legado `NEXT_PUBLIC_DATA_MODE`
foi descontinuado: nunca teve efeito sobre o app.

## Qual modo usar num deploy publico

> [!IMPORTANT]
> A amostra `official_sample` cobre **apenas 5 municipios, todos no Acre**, e
> so o indicador de homicidio doloso. Num mapa do Brasil inteiro esses pontos
> ficam minusculos num canto e a pagina parece vazia. Ela e uma **fixture de
> validacao de contrato/UI**, nao um dataset para o publico.

Recomendacao por objetivo:

| Objetivo | `NEXT_PUBLIC_CRIME_DATA_MODE` | O que aparece |
|---|---|---|
| **Demo publica completa** | `demo` (ou ausente) | 18 cidades por todo o Brasil, 8 indicadores (ficticios, rotulados "Dados demonstrativos") |
| Validar o pipeline oficial | `official_sample` | 5 municipios do Acre, so homicidio (real, mas minimo) |
| Produto real nacional | (requer carga nacional + ligacao do app) | Dados oficiais nacionais — ver `docs/CARGA_NACIONAL.md` |

Para a **demo publica atual** (sem carga nacional), use `demo` (ou remova a
variavel). Trocar de/para `official_sample` deve ser uma decisao deliberada de
validacao, nao o estado por omissao do site publico.

## Aviso importante

O deploy demo ainda usa dados demonstrativos/mockados quando
`NEXT_PUBLIC_CRIME_DATA_MODE` esta ausente.

Quando `NEXT_PUBLIC_CRIME_DATA_MODE=official_sample`, o app mostra uma amostra
oficial parcial de homicidio doloso municipal, medida em vitimas, com fonte
SINESP/MJSP e populacao IBGE. Essa amostra nao representa todos os crimes do
mapa nem a carga nacional completa.

## Estrategia recomendada para Vercel

### Opcao A - Preview oficial

Criar um deploy Preview com:

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample
```

Objetivo: validar publicamente a UX, metodologia, APIs e avisos da amostra
oficial sem alterar a producao principal.

### Opcao B - Production official_sample (apenas validacao)

> [!WARNING]
> Conforme a seccao "Qual modo usar num deploy publico", `official_sample` cobre
> so 5 municipios do Acre e **nao deve ser o estado por omissao do site
> publico**. Use esta opcao apenas para validacao temporaria; para o publico,
> prefira `demo` (ou a carga nacional `official`).

Configurar a variavel em Production para mostrar `official_sample` na URL
principal.

Risco: a demo principal deixa de ser mock e passa a mostrar apenas homicidio
doloso parcial (5 municipios do Acre).

Recomendacao: usar Preview primeiro. So promover para Production depois de
validar UX publica e metodologia.

## Checklist pos-deploy

- Pagina inicial carrega.
- Mapa carrega.
- Screenshot do README continua coerente com a tela inicial.
- Filtros funcionam.
- Ranking funciona.
- Painel de municipio abre.
- `/metodologia` abre.
- `/api/health`, `/api/metadata`, `/api/crime-map` e `/api/sources/status` retornam 200.
- Aviso de amostra oficial ou dados demonstrativos aparece conforme a camada ativa.

Para checklist detalhado do Preview `official_sample`, veja
`docs/VERCEL_OFFICIAL_SAMPLE_CHECKLIST.md`.

## Validacao local antes do deploy

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
git diff --check
```

Para validar uma URL publica, use o `SMOKE_EXPECT_DATA_MODE` que corresponde ao
modo realmente publicado:

```bash
# se a URL publica esta em demo (recomendado para o publico)
BASE_URL=https://mapa-da-violencia-brasil.vercel.app SMOKE_EXPECT_DATA_MODE=demo npm run smoke

# se esta em validacao official_sample
BASE_URL=https://mapa-da-violencia-brasil.vercel.app SMOKE_EXPECT_DATA_MODE=official_sample npm run smoke
```

### Verificacao visual (render real do dashboard)

Alem do smoke (HTTP/JSON), a checagem visual confirma que o mapa, o ranking e as
paginas renderizam de fato (desktop + mobile), falhando em mapa vazio ou erro de
JS. Local: `npx playwright install chromium` (uma vez) e `npm run build && npm run
test:visual`. Contra a URL publica:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app npm run test:visual
```
