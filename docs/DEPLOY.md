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

## Variaveis de ambiente

Nenhuma variavel de ambiente e obrigatoria nesta fase.

## Aviso importante

O deploy demo ainda usa dados demonstrativos/mockados. Os dados nao representam estatisticas oficiais reais.

## Checklist pos-deploy

- Pagina inicial carrega.
- Mapa carrega.
- Screenshot do README continua coerente com a tela inicial.
- Filtros funcionam.
- Ranking funciona.
- Painel de municipio abre.
- `/metodologia` abre.
- Aviso de dados demonstrativos aparece.

## Validacao local antes do deploy

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```
