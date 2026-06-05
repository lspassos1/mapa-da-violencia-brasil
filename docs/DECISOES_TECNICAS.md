# Decisoes Tecnicas - Mapa da Violencia Brasil

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

## ADR-013 - Evolucao da camada geografica

Status: Aceita

Decisao:

- O MVP visual usa centroides municipais demonstrativos e bounds simplificados de UFs.
- A proxima camada geografica deve ser um GeoJSON leve de UFs.
- Depois, a aplicacao deve evoluir para poligonos municipais simplificados.
- Em escala maior, a camada municipal deve migrar para vector tiles ou PMTiles.

Motivo:

- A navegacao Brasil -> Estado -> Municipio ja pode ser validada sem carregar a malha municipal completa.
- Bounds simplificados reduzem peso e risco no MVP.
- A separacao em `src/services/geoService.ts` permite trocar a origem geografica sem reescrever componentes.

Consequencias:

- O MVP atual nao representa limites reais de municipios.
- Cores municipais ainda sao aplicadas em centroides, nao em poligonos.
- A futura integracao com IBGE deve preservar `id_ibge` como chave de join entre dados e geometria.

## ADR-014 - Primeiro dado oficial publicado

Status: Aceita

Decisao:

- A primeira entrega com dado oficial deve usar o XLSX municipal SINESP/MJSP ja validado.
- O indicador publicado nesse recorte e `homicidio_doloso`.
- A unidade e `vitimas`, usando a coluna `Vítimas`; o valor nao deve ser tratado como ocorrencias.
- Indicadores sem dado oficial validado devem ficar ocultos da camada oficial.
- A Base VDE continua como trilha P0 paralela para descobrir se ha multiplos indicadores municipais.

Motivo:

- O app visual ja pode consumir dados agregados, mas a VDE ainda nao foi baixada e inspecionada integralmente.
- O dicionario municipal SINESP/MJSP resolveu a ambiguidade do XLSX municipal com confianca alta.
- Publicar um recorte oficial estreito e metodologicamente honesto e mais seguro do que manter multiplos indicadores mockados como se fossem oficiais.

Consequencias:

- O filtro oficial inicial mostra apenas homicidio doloso.
- A taxa por 100 mil usa populacao IBGE 2025 ate a serie populacional historica ser integrada.
- O app precisa diferenciar `sem_dados`, `zero_registrado` e `populacao_indisponivel`.

## ADR-015 - Privacidade dos tiles do mapa base

Status: Aceita

Contexto:

- O mapa base carrega tiles diretamente do browser do utilizador para
  `*.basemaps.cartocdn.com` (CARTO). Isto expoe o IP e o padrao de navegacao
  de cada utilizador a um terceiro, sem aviso nem opt-out.
- Para uma ferramenta civica que pode ser usada em contextos sensiveis
  (jornalismo, ativismo), isto e uma consideracao de privacidade relevante.

Opcoes avaliadas:

- **A. Proxy de tiles** (route handler que busca os tiles server-side): esconde
  o IP do utilizador do CARTO, mas adiciona latencia, custo de largura de banda
  e potencial atrito com os ToS do CARTO para volume elevado.
- **B. Cache na edge** (Vercel/Cloudflare): os IPs chegam a edge, nao ao CARTO
  diretamente; equilibrio entre privacidade e custo.
- **C. Aceitar e documentar**: manter o carregamento direto, com atribuicao e
  nota de privacidade, e tratar o proxy como evolucao futura.
- **D. Self-hosted (PMTiles)**: servir os tiles do proprio bucket/CDN; elimina o
  terceiro, mas exige gerar e hospedar a malha (ver ADR-013 / issue #14).

Decisao:

- Adotar a **Opcao C** no estado atual (MVP/demo): manter o carregamento direto
  com a atribuicao CARTO/OpenStreetMap ja presente no rodape (PR #26) e nesta
  nota de decisao.
- A origem dos tiles ja e configuravel por ambiente (`NEXT_PUBLIC_MAP_TILE_URLS`,
  PR #28), o que permite trocar para um proxy/self-hosted sem alterar codigo.
- Reavaliar para **Opcao B ou D** antes de uma divulgacao publica ampla, ou
  imediatamente se o app passar a tratar dados/uso sensiveis.

Motivo:

- Proxyar ou self-hostar tiles num MVP ainda sem dados reais adiciona custo e
  complexidade desproporcionais ao risco atual.
- Tornar a origem configuravel mantem a porta aberta para endurecer a
  privacidade sem retrabalho.

Consequencias:

- O rodape mantem a atribuicao obrigatoria do CARTO/OpenStreetMap.
- Fica registado que o carregamento direto expoe IPs ao CARTO; a mitigacao
  (proxy/edge/self-hosted) e trabalho rastreado e nao um detalhe esquecido.
- A futura malha self-hosted (ADR-013) e o caminho preferido para resolver
  privacidade e dependencia externa em simultaneo.
