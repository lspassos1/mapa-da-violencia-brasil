# Vercel Official Sample Checklist

Use este checklist para validar um deploy publico com:

```txt
NEXT_PUBLIC_CRIME_DATA_MODE=official_sample
```

Sem essa variavel, o app deve permanecer em mock/default.

## Escopo validado

`official_sample` e uma amostra oficial parcial de homicidio doloso municipal,
medida em vitimas, com fonte SINESP/MJSP e populacao IBGE. Ela nao representa
todos os crimes do mapa nem a carga nacional completa.

## Estrategia recomendada

Use Vercel Preview primeiro. So configure Production com
`NEXT_PUBLIC_CRIME_DATA_MODE=official_sample` depois de validar UX publica,
metodologia e endpoints.

## Checklist publico

- [ ] `/` carrega.
- [ ] `/metodologia` carrega.
- [ ] `/api/health` retorna 200.
- [ ] `/api/metadata` indica `official_sample`.
- [ ] `/api/sources/status` indica SINESP/MJSP e IBGE.
- [ ] `/api/crime-map` retorna dados agregados.
- [ ] `/api/municipalities/1200401` retorna municipio da amostra oficial.
- [ ] UI mostra "amostra oficial parcial" ou aviso equivalente.
- [ ] UI informa homicidio doloso.
- [ ] UI informa unidade vitimas.
- [ ] UI nao mostra multiplos crimes como se fossem oficiais.
- [ ] Nenhum endpoint vaza `data/raw`, `data/manual`, `data/processed` ou caminhos locais.
- [ ] Modo mock continua funcionando quando a variavel esta ausente.

## Smoke em URL publica

Com um servidor local ou URL publica disponivel, rode:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app SMOKE_EXPECT_DATA_MODE=official_sample npm run smoke
```

Se `npm` nao estiver disponivel no ambiente local, use o runtime Node fallback
documentado em `scripts/validate-local.sh`:

```bash
BASE_URL=https://mapa-da-violencia-brasil.vercel.app \
SMOKE_EXPECT_DATA_MODE=official_sample \
/Users/lucaspassos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/smoke-public-routes.mjs
```
