# Mapa da Violencia Brasil

Aplicacao web experimental para visualizar indicadores de violencia no Brasil em um mapa dinamico. A versao atual valida a experiencia de produto com dados demonstrativos locais, navegacao Brasil -> Estado -> Municipio e uma arquitetura preparada para futuras fontes oficiais.

> Esta versao usa dados demonstrativos/mockados. Os dados nao representam estatisticas oficiais reais.

## Demo

Deploy Vercel: em preparacao.

![Screenshot do MVP visual do Mapa da Violencia Brasil](docs/assets/mvp-screenshot.jpg)

## Funcionalidades atuais

- Mapa dinamico com MapLibre GL JS.
- Visao Brasil -> Estado -> Municipio.
- Centroides municipais coloridos por score de 0 a 100.
- Filtros por indicador de violencia.
- Filtros por modo de visualizacao: indice, total, taxa por 100 mil e variacao mensal.
- Ranking de municipios mais criticos conforme o filtro atual.
- Painel de detalhes por municipio.
- Pagina de metodologia em `/metodologia`.
- APIs mockadas para mapa e municipio.
- Aviso visivel de dados demonstrativos na interface.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- MapLibre GL JS
- ESLint
- Dados mockados locais

## Como rodar localmente

Instale as dependencias:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:3000
```

## Comandos uteis

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deploy

O projeto esta pronto para deploy demo na Vercel como aplicacao Next.js, sem variaveis de ambiente obrigatorias nesta fase. Veja [docs/DEPLOY.md](docs/DEPLOY.md).

## Estrutura do projeto

```txt
src/app        Rotas Next.js, pagina principal, metodologia e APIs mockadas
src/components Componentes visuais do dashboard, mapa, filtros e paineis
src/data       Dados demonstrativos locais e placeholders geograficos
src/lib        Utilitarios de calculo, formatacao, ranking, risco e navegacao
src/services   Camada de leitura preparada para substituir mocks por API real
src/types      Tipos compartilhados de crime, mapa e geografia
docs           Documentacao tecnica, arquitetura, metodologia e proximas fases
etl            Fundacao inicial para scripts e testes de ETL
```

## Roadmap resumido

1. Camada real de UFs.
2. Populacao IBGE.
3. Base SINESP/VDE.
4. Normalizacao dos indicadores.
5. Banco Supabase/PostGIS.
6. Poligonos municipais.
7. Vector tiles ou PMTiles.
8. Indice geral real.
9. Atualizacao automatica.

## Licenca

Este projeto esta licenciado sob a GNU Affero General Public License v3.0. Veja [LICENSE](LICENSE).
