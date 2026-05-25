# Decisoes Tecnicas - Radar da Violencia Brasil

Data do plano: 2026-05-25

## ADR-001 - Comecar por planejamento, nao implementacao

Status: Aceita

Decisao:

- Esta entrega cria apenas documentacao em `/docs`.

Motivo:

- O prompt mestre pede plano tecnico completo antes de escrever codigo.
- O repositorio esta vazio e precisa de decisoes explicitas antes de scaffold.

Consequencias:

- Nenhuma dependencia instalada.
- Nenhum app criado.
- Nenhum banco alterado.

## ADR-002 - Next.js + TypeScript para o app web

Status: Proposta

Decisao:

- Usar Next.js App Router com TypeScript.

Motivo:

- Permite frontend, route handlers, cache e deploy Vercel no mesmo projeto.
- TypeScript reduz risco em contratos de API e dados.

Consequencias:

- A maior parte da interatividade do mapa ficara em componentes client-side.
- Dados e consultas sensiveis devem ficar em server-side route handlers.

## ADR-003 - MapLibre GL como mapa principal

Status: Proposta

Decisao:

- Usar MapLibre GL JS no MVP.

Motivo:

- Open source.
- Suporta fontes vetoriais, GeoJSON, feature-state e estilos modernos.
- Evita obrigatoriedade inicial de Mapbox token.

Alternativa:

- Mapbox GL JS, se houver necessidade de tiles/estilos proprietarios ou suporte comercial.

## ADR-004 - Supabase Postgres + PostGIS

Status: Proposta

Decisao:

- Usar Supabase Postgres com PostGIS.

Motivo:

- PostGIS e apropriado para geometrias, bbox e indices GIST.
- Supabase oferece Postgres gerenciado, extensoes e boa integracao com Next.js.

Cuidados:

- Nunca expor service role no frontend.
- Habilitar RLS em tabelas expostas.
- Usar views com `security_invoker` quando aplicavel.
- Instanciar clientes server-side de forma segura, sem depender de segredo no browser.

## ADR-005 - Python para ETL

Status: Proposta

Decisao:

- Usar Python com pandas/geopandas para ETL.

Motivo:

- Melhor ecossistema para CSV, XLSX, ZIP, shapefile, GeoJSON e operacoes geoespaciais.

Consequencias:

- O repo tera runtime Node para app e Python para ETL.
- CI precisa validar os dois ambientes quando ETL existir.

## ADR-006 - GeoJSON/TopoJSON no MVP, vector tiles na producao

Status: Proposta

Decisao:

- MVP usa asset geografico simplificado.
- Producao evolui para PMTiles/MBTiles/vector tiles se necessario.

Motivo:

- 5.570 municipios sao viaveis em asset simplificado.
- Vector tiles adicionam complexidade que nao e necessaria antes do fluxo principal estar validado.

Gatilhos para migrar:

- Asset geografico pesado demais.
- Performance ruim em mobile.
- Necessidade de multiplos niveis de detalhe.
- Camadas adicionais alem de municipios/UF.

## ADR-007 - Taxa por 100 mil como padrao para indicadores individuais

Status: Proposta

Decisao:

- Para crimes individuais, a visualizacao padrao deve ser taxa por 100 mil habitantes.

Motivo:

- Evita pintar sempre grandes cidades como piores apenas por populacao.

Consequencias:

- Populacao municipal vira dado obrigatorio do MVP.
- Municipios sem populacao nao entram em ranking por taxa.

## ADR-008 - Indice geral versionado e configuravel

Status: Proposta

Decisao:

- O indice geral usa media ponderada de scores por indicador.
- Pesos ficam em tabela/configuracao.
- Toda mudanca gera nova `metodologia_versao`.

Motivo:

- Evita hardcode opaco.
- Permite auditoria e comparacao entre versoes.

Consequencias:

- A pagina de metodologia precisa mostrar a versao ativa.
- Rankings historicos devem saber qual versao usaram.

## ADR-009 - Dados ausentes nao sao zero

Status: Aceita

Decisao:

- `sem_dados` e `zero_registrado` sao estados diferentes.

Motivo:

- Pintar ausencia de dado como baixa incidencia induz erro.

Consequencias:

- API e frontend precisam retornar status de dado, nao apenas valor numerico.

## ADR-010 - Fontes estaduais como adaptadores independentes

Status: Proposta

Decisao:

- RJ, SP, MG e BA entram por conectores separados.

Motivo:

- Cada estado publica formato, periodicidade e metodologia diferentes.

Consequencias:

- A camada normalizada precisa ocultar diferencas sem apagar a origem.
- Fonte prioritaria deve ser exibida no app.

## ADR-011 - Nao usar dados pessoais ou coordenadas de ocorrencias individuais

Status: Aceita

Decisao:

- O MVP usa apenas dados agregados por municipio, mes e indicador.

Motivo:

- Reduz risco de privacidade, estigmatizacao e uso indevido.

Consequencias:

- Sem mapa de pontos de crime.
- Sem bairro/endereco no MVP.

## ADR-012 - Validacao de release

Status: Aceita

Decisao:

- Antes de pronto/merge, rodar:

```bash
npm ci
git diff --check
npm run lint
npm run test
npm run build
```

Motivo:

- Proteger contra regressao e build quebrado.

Consequencias:

- Enquanto nao houver codigo, esses comandos nao se aplicam.
- Quando app existir, falhas bloqueiam release.
