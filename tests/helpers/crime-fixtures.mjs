// Fabricas minimas de dados para os testes de unidade de src/lib.

export function makeMetric(overrides = {}) {
  return {
    score: 50,
    nivel: "atencao",
    total: 100,
    taxa100k: 12.5,
    variacaoMensal: null,
    variacaoAnual: null,
    dataStatus: "amostra_oficial",
    unidade: "vitimas",
    fonte: "TEST",
    ...overrides,
  };
}

export function makeMunicipality(overrides = {}) {
  const { indicadores, ...rest } = overrides;
  return {
    idIbge: "0000001",
    municipio: "Teste",
    uf: "SP",
    estado: "Sao Paulo",
    lat: -23,
    lng: -46,
    populacao: 1000,
    periodo: "2018-03",
    indicadores: indicadores ?? { homicidioDoloso: makeMetric() },
    ...rest,
  };
}
