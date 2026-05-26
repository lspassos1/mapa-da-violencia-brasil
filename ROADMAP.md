# Roadmap

## Fase 0 - Planejamento e MVP visual

Status: concluido.

Entregas:

- Documentacao tecnica inicial em `docs/`.
- Licenca AGPL-3.0.
- Fundacao inicial de ETL.
- MVP visual com Next.js, TypeScript, Tailwind CSS e MapLibre.
- Dados demonstrativos locais e APIs mockadas.

## Fase 1 - Repositorio publico e deploy demo

Status: concluido.

Entregas:

- README profissional.
- Deploy Vercel: https://mapa-da-violencia-brasil.vercel.app.
- Screenshot do MVP no README.
- Templates de issues iniciais.
- Documentacao de contribuicao.
- Checklist publico de validacao.

## Fase 2 - Dados reais locais/offline

Tarefas:

- Baixar base nacional SINESP/VDE.
- Estudar formato, colunas e granularidade.
- Normalizar indicadores.
- Criar script offline de ingestao.
- Validar join por codigo IBGE.
- Gerar JSON/CSV normalizado.

## Fase 3 - Geografia real

Tarefas:

- Integrar malha de UFs.
- Integrar malha municipal simplificada.
- Testar performance em desktop e mobile.
- Avaliar vector tiles ou PMTiles.

## Fase 4 - Banco e API real

Tarefas:

- Criar schema Supabase/PostGIS.
- Criar tabelas de municipios.
- Criar tabelas de indicadores.
- Criar tabelas de fontes.
- Trocar APIs mockadas por API real.

## Fase 5 - Atualizacao automatica

Tarefas:

- Job agendado de ingestao.
- Logs de ingestao.
- Validacao de fonte.
- Painel de status dos dados.

## Fase 6 - Plataforma publica

Tarefas:

- Deploy final.
- Dominio.
- SEO basico.
- Pagina de metodologia completa.
- Termos e avisos sobre uso dos dados.
