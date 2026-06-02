# Proximas Etapas - Mapa da Violencia Brasil

Data: 2026-05-25

## Proxima fase recomendada

A proxima fase deve publicar um primeiro recorte oficial estreito e auditavel antes de conectar Supabase/PostGIS ou expandir indicadores.

Decisao ativa: iniciar com `homicidio_doloso` municipal do SINESP/MJSP, medido em `vitimas`, usando a populacao IBGE 2025 para taxa por 100 mil. A Base VDE segue como trilha paralela para confirmar se ha multiplos indicadores municipais.

Escopo recomendado:

- Conectar dados reais primeiro em modo offline/local.
- Gerar camada app-ready JSON para homicidio doloso real.
- Ocultar indicadores sem fonte oficial validada na camada oficial.
- Criar schema inicial em banco local ou arquivo intermediario versionavel.
- Validar o join por codigo IBGE entre criminalidade, populacao e geometria.
- So depois conectar Supabase/PostGIS.

## Ordem recomendada

1. Integrar camada real de UFs.
2. Integrar populacao IBGE. Parcialmente preparado em modo offline/local: parser ODS, CSV processado local e validacao de `id_ibge`.
3. Gerar JSON app-ready do SINESP municipal validado.
4. Retomar download/inspecao da Base VDE.
5. Criar normalizador VDE somente se o schema real for municipal e multi-indicador.
6. Criar schema Supabase/PostGIS.
7. Trocar mock por API real ou artefato app-ready.
8. Adicionar poligonos municipais/vector tiles.

## Evolucao geografica

1. MVP atual: centroides municipais + bounds simplificados de estados.
2. Proxima camada: GeoJSON leve de UFs.
3. Depois: poligonos municipais simplificados.
4. Depois: vector tiles ou PMTiles para escala nacional com boa performance.

## Riscos

- Diferenca de nomenclatura entre fontes.
- Atraso de atualizacao oficial.
- Municipios com nomes repetidos.
- Mudanca de codigo ou limites municipais.
- Volume de geometria.
- Performance no navegador.
- Falsa comparacao por numeros absolutos.
- Necessidade de taxa por 100 mil habitantes.

## Guardrails para a proxima fase

- Manter dados pessoais e ocorrencias individuais fora do produto.
- Preservar `id_ibge` como chave principal de integracao.
- Registrar fonte, periodo, data de ingestao e status de qualidade em cada carga.
- Falhar explicitamente quando uma fonte mudar schema.
- Manter dados demonstrativos separados de dados oficiais.
