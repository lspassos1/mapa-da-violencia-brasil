# Deploy Demo na Vercel

Este documento descreve o deploy demo do Mapa da Violencia Brasil na Vercel.

Status desta fase: o app esta pronto para importacao manual no painel da Vercel ou deploy via Git integration. Nenhuma integracao com SINESP, IBGE, Supabase, PostGIS ou vector tiles deve ser feita nesta etapa.

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

## Atualizar README apos deploy

Quando a URL publica estiver disponivel, substitua:

```txt
Deploy Vercel: em preparacao.
```

por:

```txt
Deploy Vercel: https://...
```

## Validacao local antes do deploy

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```
