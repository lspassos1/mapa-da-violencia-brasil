import type { MunicipalityCrimeData, UfDatum } from "@/types/crime";

// Converte um registo so-UF num item com a forma de municipio, para reutilizar o
// RankingPanel/ordenacao existentes ao listar o ranking ESTADUAL dos indicadores
// que so existem a nivel UF. `idIbge`/`uf` recebem a sigla; lat/lng nao sao usados
// (o degrade dos estados vem de ufData, nao destes itens).
export function ufDatumToMunicipality(datum: UfDatum, nome: string): MunicipalityCrimeData {
  return {
    idIbge: datum.uf,
    municipio: nome,
    uf: datum.uf,
    estado: nome,
    lat: 0,
    lng: 0,
    populacao: 0,
    periodo: datum.periodo,
    indicadores: {
      [datum.indicador]: {
        score: datum.score,
        nivel: datum.nivel,
        total: datum.total,
        taxa100k: datum.taxa100k,
        variacaoMensal: null,
        variacaoAnual: null,
        dataStatus: datum.dataStatus,
        unidade: datum.unidade,
        fonte: "MJSP/SINESP - Base VDE",
      },
    },
  };
}
