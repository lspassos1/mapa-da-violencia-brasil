// Radar de anomalia — LENTE 2 NACIONAL (#85, eixo 2): governança criminal por UF.
//
// A lente 2 do RJ usava tiroteios (Fogo Cruzado) + extorsão/tráfico municipal
// (ISP-RJ) — dado que só o RJ publica. Para cobrir TODOS os estados sem inventar,
// aqui usamos um proxy NACIONAL e population-free: a INTENSIDADE de homicídio =
// homicídios ÷ óbitos totais (SIM/DATASUS), comparável entre UFs (normaliza pela
// base de óbitos, que escala com a população). Cruzamos com a presença de facção.
//
// Hipótese (RES 86(2) / literatura BR): onde há crime organizado, violência
// registrável ATÍPICAMENTE BAIXA pode indicar MONOPÓLIO/controle ("pax"), e ALTA
// indica DISPUTA (guerra entre grupos). Caso canônico: SP (PCC) = menor intensidade
// do país apesar de facção forte → "pax monopolista". Norte (PA/RR/AM/AP) = facção
// + intensidade alta → disputa nas rotas. INDÍCIO/leitura coarse, nunca acusação.
import "server-only";
import hidden from "@/data/hiddenHomicides.json";
import { faccoesNaUf } from "@/server/anomaly/factionPresence";

const ANOS_RECENTES = 4; // janela recente p/ a intensidade
const CONTROLE_MAX_REL = 0.7; // intensidade < 70% da mediana + facção -> controle/pax
const DISPUTA_MIN_REL = 1.3; // > 130% da mediana + facção -> disputa

export type GovClass = "controle" | "disputa" | "misto" | "sem_faccao";

export interface UfGovernance {
  uf: string;
  intensidade: number; // homicídios / óbitos totais (média da janela recente)
  intensRelativa: number; // intensidade / mediana nacional
  faccoes: number; // facções nacionais na UF (0/1/2)
  classificacao: GovClass;
}

interface YearStat {
  homicidios: number;
  total: number;
}
type Series = Record<string, Record<string, YearStat>>;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round = (n: number, c = 4) => Math.round(n * 10 ** c) / 10 ** c;

// Intensidade = soma(homicídios)/soma(óbitos) nos últimos ANOS_RECENTES anos.
function intensidadeRecente(serie: Record<string, YearStat>): number {
  const anos = Object.keys(serie).sort().slice(-ANOS_RECENTES);
  let h = 0;
  let t = 0;
  for (const a of anos) {
    h += serie[a].homicidios;
    t += serie[a].total;
  }
  return t > 0 ? h / t : 0;
}

// Classificação (PURA/testável): facção é a condição; intensidade relativa decide
// controle×disputa.
export function classifyGovernance(intensRelativa: number, faccoes: number): GovClass {
  if (faccoes <= 0) return "sem_faccao";
  if (intensRelativa < CONTROLE_MAX_REL) return "controle";
  if (intensRelativa > DISPUTA_MIN_REL) return "disputa";
  return "misto";
}

export interface GovernanceNacional {
  mediana: number;
  fonte: string;
  ufs: UfGovernance[];
}

// Lente 2 nacional por UF. Ordena por intensidade asc (controle/pax primeiro).
export function getCriminalGovernanceNacional(): GovernanceNacional {
  const series = (hidden as { series: Series }).series ?? {};
  const base = Object.keys(series)
    .filter((uf) => Object.keys(series[uf]).length > 0)
    .map((uf) => ({ uf, intensidade: intensidadeRecente(series[uf]), faccoes: faccoesNaUf(uf) }));
  const mediana = median(base.map((r) => r.intensidade));
  const ufs: UfGovernance[] = base
    .map((r) => {
      const rel = mediana ? r.intensidade / mediana : 1;
      return {
        uf: r.uf,
        intensidade: round(r.intensidade),
        intensRelativa: round(rel, 2),
        faccoes: r.faccoes,
        classificacao: classifyGovernance(rel, r.faccoes),
      };
    })
    .sort((a, b) => a.intensidade - b.intensidade);
  return { mediana: round(mediana), fonte: "SIM/DATASUS + Mapa das Orcrim 2024 (MJ)", ufs };
}
