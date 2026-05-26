# Proximas Etapas - Mapa da Violencia Brasil

Data: 2026-05-25

## Proxima fase recomendada

Antes de conectar Supabase/PostGIS ou expor dados reais no app, a proxima fase deve integrar dados oficiais em modo offline/local.

Proxima fase tecnica: integracao de dados reais em modo offline/local antes de conectar banco em producao.

Escopo recomendado:

- Conectar dados reais primeiro em modo offline/local.
- Baixar e normalizar a fonte nacional.
- Mapear indicadores oficiais para os indicadores internos do app.
- Criar schema inicial em banco local ou arquivo intermediario versionavel.
- Validar o join por codigo IBGE entre criminalidade, populacao e geometria.
- So depois conectar Supabase/PostGIS.

## Ordem recomendada

1. Integrar camada real de UFs.
2. Integrar populacao IBGE.
3. Integrar base nacional SINESP/VDE.
4. Criar normalizador de indicadores.
5. Criar banco local ou SQLite temporario.
6. Criar schema Supabase/PostGIS.
7. Trocar mock por API real.
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
