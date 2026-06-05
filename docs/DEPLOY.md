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

### Opcao B - Production official_sample

Configurar a variavel em Production para mostrar `official_sample` na URL
principal.

Risco: a demo principal deixa de ser mock e passa a mostrar apenas homicidio
doloso parcial.

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

Para validar uma URL publica:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app SMOKE_EXPECT_DATA_MODE=official_sample npm run smoke
```
