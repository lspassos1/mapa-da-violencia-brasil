# Fontes de Dados - Radar da Violencia Brasil

Data de validacao inicial: 2026-05-25

## 1. Principio de fontes

Usar apenas dados oficiais, publicos e agregados. A primeira versao nao deve usar microdados pessoais, enderecos individuais, boletins de ocorrencia identificaveis ou dados que permitam vigilancia individual.

Toda fonte deve registrar:

- URL de origem.
- Data de download.
- Checksum do arquivo.
- Periodo de referencia.
- Licenca/termos quando disponiveis.
- Status de qualidade.
- Observacoes metodologicas.

## 2. Fonte nacional principal - MJSP/SINESP

Fonte:

- Portal de dados: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Recurso VDE atual validado: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica/resource/e9d6cc2b-33f1-468d-ab09-9aa8303c2eba

Status validado:

- O conjunto "Ocorrencias Criminais - Sinesp" informa que os indicadores sao alimentados por estados e DF via Sinesp VDE.
- O portal informa 28 indicadores nacionais.
- O recurso "Base de Dados VDE" esta em ZIP, cobre periodo 2015 a 2026 e consta como atualizado em 30/04/2026.
- Licenca indicada no recurso: Creative Commons Atribuicao.

Indicadores citados pela fonte nacional:

- homicidio doloso;
- roubo seguido de morte;
- lesao corporal seguida de morte;
- homicidio tentado;
- feminicidio;
- morte por intervencao de agente do Estado;
- morte a esclarecer;
- morte no transito;
- estupro;
- roubo de veiculos;
- roubo de carga;
- furto de veiculos;
- trafico de drogas;
- apreensoes;
- pessoa desaparecida/localizada;
- outros indicadores administrativos.

Risco principal:

- Confirmar na Fase 0 se o ZIP VDE atual possui granularidade municipal para todos os indicadores necessarios. Se trouxer apenas UF para alguns indicadores, esses dados nao devem ser usados para pintar municipios individualmente.

Tarefas de ETL:

1. Baixar ZIP.
2. Calcular checksum.
3. Extrair em area temporaria.
4. Identificar arquivos internos e encoding.
5. Validar colunas.
6. Normalizar periodos, UFs, indicadores e municipios.
7. Registrar arquivo bruto.
8. Inserir em `ocorrencias_crime`.
9. Calcular metricas.

## 3. Base geografica - IBGE Malha Municipal

Fonte:

- https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html

Status validado:

- A pagina da Malha Municipal informa arquivos da Malha Municipal Digital 2025.
- Os arquivos sao organizados por UF e, desde 2015, tambem para Brasil.
- Formato indicado: Shapefile.

Uso no produto:

- Geometria oficial dos municipios.
- Codigo IBGE de 7 digitos como chave de join.
- Contorno de UF.
- Centroide e bbox para busca e zoom.

Tarefas de ETL:

1. Baixar malha nacional ou por UF.
2. Converter para EPSG:4326 se necessario.
3. Validar geometrias.
4. Unificar `Polygon` e `MultiPolygon`.
5. Gerar centroides e bbox.
6. Simplificar geometrias para web.
7. Inserir geometria completa no PostGIS.
8. Exportar GeoJSON/TopoJSON simplificado para o frontend.

## 4. Populacao municipal - IBGE

Fonte:

- https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativa-de-populacao.html

Status validado:

- O IBGE publica estimativas populacionais dos municipios e UFs com data de referencia em 1 de julho.
- A pagina indica politica de revisao de dados.
- O prompt original menciona estimativas de 2025; a Fase 0 deve baixar o arquivo atual disponivel e registrar o ano de referencia usado.

Uso no produto:

- Calculo da taxa por 100 mil habitantes.
- Comparacao justa entre municipios pequenos e grandes.

Formula:

```txt
taxa_100k = (ocorrencias / populacao) * 100000
```

Tarefas de ETL:

1. Baixar XLS/ODS/PDF convertido para tabela, preferindo formato tabular.
2. Normalizar codigo IBGE.
3. Inserir em `populacao_municipal`.
4. Atualizar `municipios.populacao_atual`.
5. Registrar fonte e ano de referencia.

## 5. Fonte estadual - Rio de Janeiro / ISPDados

Fonte:

- https://www.ispdados.rj.gov.br/

Status validado:

- O portal ISPDados disponibiliza bases de registros criminais e atividade policial do RJ.
- A pagina informa revisao e equalizacao de codigos de ocorrencia ao longo do tempo.
- Ha paineis e arquivos auxiliares no ecossistema do ISP.

Uso planejado:

- Conector estadual inicial em `etl/sources/rj_ispdados.py`.
- Melhorar granularidade/frequencia para RJ.
- Recurso inicial: `https://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv`.
- Normalizacao inicial: base municipal mensal em formato largo, com indicadores como homicidio doloso, feminicidio, latrocinio, roubo/furto de veiculos, roubo de carga, estupro, trafico de drogas e pessoas desaparecidas.

Cuidados:

- Ler notas metodologicas antes de comparar com SINESP.
- Registrar diferencas de titulos e revisoes.
- Nao substituir SINESP sem informar fonte prioritaria no app.

## 6. Fonte estadual - Sao Paulo / Dados Abertos SP e SSP-SP

Fonte:

- https://dadosabertos.sp.gov.br/dataset/?organization=secretaria-da-seguranca-publica

Status validado:

- O portal lista conjuntos da Secretaria da Seguranca Publica.
- A pagina indica acesso via API CKAN.
- Ha conjunto "BASE DE DADOS DA SECRETARIA DA SEGURANCA PUBLICA".

Uso planejado:

- Conector independente `sp_ssp.py`.
- Preferir API CKAN quando arquivos e metadados forem acessiveis por pacote/recurso.
- Conector inicial criado em `etl/sources/sp_ssp.py`.
- Estado atual do conector: descoberta de recursos do dataset CKAN `numeros-sem-misterio`.
- Limitacao atual: o CKAN aponta para paginas/consultas oficiais da SSP-SP, nao para um CSV/XLSX direto e estavel; a normalizacao fica bloqueada ate selecionar o endpoint oficial de download.

Cuidados:

- Validar granularidade municipal.
- Validar periodicidade e campos.
- Registrar se o recurso for PDF, XLSX ou outro formato menos ideal.

## 7. Fonte estadual - Minas Gerais / SEJUSP

Fontes:

- https://www.seguranca.mg.gov.br/index.php/transparencia/dados-abertos
- https://dados.mg.gov.br/dataset/crimes-violentos

Status validado:

- A pagina de dados abertos da SEJUSP informa dados de criminalidade dos 853 municipios de Minas Gerais.
- Ha CSVs para crimes violentos, incluindo recortes 2025 a 2026.
- O portal de dados de MG lista recursos anuais de crimes violentos ate 2026.

Uso planejado:

- Conector estadual inicial em `etl/sources/mg_seguranca.py`.
- Excelente candidato para carga estadual inicial.
- Pode validar rapidamente o pipeline municipal, porque a fonte declara cobertura dos municipios mineiros.
- Recurso inicial: dataset CKAN `crimes-violentos`, com CSVs anuais de 2019 a 2026 no portal `dados.mg.gov.br`.
- Normalizacao inicial: formato longo com `registros`, `natureza`, `municipio`, `cod_municipio`, `mes` e `ano`.

Cuidados:

- Checar licenca no portal de dados antes de uso publico.
- A pagina do dataset consultado indicou "No License Provided"; isso exige decisao juridica/produto antes de republicacao ampla.
- Resolver `cod_municipio` de 6 digitos para `id_ibge` de 7 digitos em etapa posterior usando tabela oficial do IBGE.
- Registrar metodologia e data de extracao.

## 8. Fonte estadual - Bahia / SSP-BA

Fonte:

- https://dados.ba.gov.br/dataset/morte_violenta_estado
- API CKAN: https://dados.ba.gov.br/api/3/action/package_show?id=morte_violenta_estado

Status validado:

- O dataset "Morte Violenta Intencional no Estado" e mantido pela SSP-BA.
- A API CKAN informa periodicidade mensal.
- O recurso CSV `MORTES_VIOLENTAS_ESTADO_2024_2025_2026.csv` estava atualizado ate abril de 2026 na verificacao inicial.
- Licenca indicada no CKAN: "Outra (Aberta)".

Uso planejado:

- Conector estadual inicial em `etl/sources/ba_ssp.py`.
- Recurso inicial: CSV de mortes violentas intencionais por municipio, ano, mes e natureza.
- Normalizacao inicial: `QT_VITIMAS` vira `value` e `victims`; `ID_MUNICIPIO` e preservado como codigo municipal da fonte quando vier com 6 digitos.

Cuidados:

- A fonte cobre mortes violentas intencionais, nao todos os indicadores do produto.
- Validar se as modalidades sao vitimas ou ocorrencias antes de comparar com fontes que usam registros.
- Resolver o codigo IBGE de 7 digitos em etapa posterior usando malha/tabela oficial do IBGE; nao inferir o digito final.
- Exibir no app que a medida normalizada desta fonte e baseada em vitimas.

## 9. Regra de precedencia entre fontes

Quando houver sobreposicao:

1. Fonte estadual oficial com dados municipais, metadados claros e periodo mais recente.
2. SINESP/MJSP municipal.
3. SINESP/MJSP por UF apenas para paineis agregados.
4. Dados manuais ou amostras apenas para demo, nunca misturados como oficiais.

A resposta da API deve indicar:

```json
{
  "fontePrioritaria": "SEJUSP-MG",
  "fontesDisponiveis": ["SINESP/MJSP", "SEJUSP-MG"],
  "statusQualidade": "oficial_estadual"
}
```

## 10. Qualidade e alertas

Alertas obrigatorios:

- Arquivo novo com checksum diferente.
- Coluna esperada ausente.
- Indicador desconhecido.
- Municipio sem match por `id_ibge`.
- Queda brusca de linhas contra execucao anterior.
- Valores negativos.
- Populacao ausente.
- Periodo mais recente menor que periodo ja carregado.

## 11. Dados que nao devem entrar no MVP

- Endereco de ocorrencia.
- Nome de vitima, suspeito, testemunha ou agente publico.
- Numero de boletim de ocorrencia.
- Coordenadas exatas de evento individual.
- Dados por pessoa.
- Dados nao oficiais sem revisao.
