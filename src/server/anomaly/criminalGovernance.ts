// Radar de anomalia — LENTE 2 (#85, eixo 2): governança criminal no RJ.
// Cruza tiroteios (Fogo Cruzado) com o mercado criminal (ISP-RJ) por município
// para distinguir:
//  - "controle/monopólio" (indício de milícia/pax): violência armada existe MAS
//    quase sem "Disputa" entre grupos + economia de extorsão ativa — um grupo
//    domina e suprime o confronto registrável (LSE: ~3% dos confrontos em área
//    de milícia). NÃO é "lugar seguro".
//  - "disputa ativa": muita "Disputa" + alta letalidade — guerra entre facções.
//
// ⚠️ INDÍCIO, não prova/acusação. Cobertura: RJ (onde há dado). Sempre mostrar os
// sinais crus ao lado da classificação. Ver §literatura no #85.
import "server-only";
import shootings from "@/data/rjShootings.json";
import isp from "@/data/rjIspCrime.json";
import { normalizeName } from "@/server/osint/geocode";

export const ANO_REF = "2024"; // último ano completo comum às duas bases
const DISPUTA_ALTA = 0.1; // share de tiroteios por "Disputa" -> guerra de facção
const CONTROLE_BAIXO = 0.03; // ~sem disputa apesar de violência armada -> monopólio
const ROBUSTO_MIN_TIROTEIOS = 20; // abaixo disso o share é ruidoso

export type Classificacao = "controle" | "disputa" | "misto";

export interface RjGovernanceRow {
  municipio: string;
  tiroteios: number;
  disputa: number;
  disputaShare: number; // 0..1
  mortosTiroteio: number;
  letalidade: number | null; // ISP
  extorsao: number | null;
  trafico: number | null;
  desaparecidos: number | null;
  classificacao: Classificacao;
  robusto: boolean;
}

type FcSeries = Record<string, Record<string, { oc: number; disputa: number; policia: number; mortos: number; feridos: number }>>;
type IspSeries = Record<string, Record<string, { letalidade: number; trafico: number; extorsao: number; desaparecidos: number; roubos: number }>>;

function ispByNormalizedName(ano: string): Map<string, { letalidade: number; trafico: number; extorsao: number; desaparecidos: number; roubos: number }> {
  const series = (isp as { series: IspSeries }).series;
  const map = new Map<string, IspSeries[string][string]>();
  for (const [mun, anos] of Object.entries(series)) {
    const v = anos[ano];
    if (v) map.set(normalizeName(mun), v);
  }
  return map;
}

function classifica(disputaShare: number, robusto: boolean): Classificacao {
  if (!robusto) return "misto";
  if (disputaShare >= DISPUTA_ALTA) return "disputa";
  if (disputaShare <= CONTROLE_BAIXO) return "controle";
  return "misto";
}

const ordem: Record<Classificacao, number> = { controle: 0, disputa: 1, misto: 2 };

// Linhas da lente 2 para o ano de referência, ordenadas: indício de controle
// primeiro (por extorsão desc), depois disputa (por tiroteios desc), depois o resto.
export function getRjCriminalGovernance(ano: string = ANO_REF): RjGovernanceRow[] {
  const fc = (shootings as { series: FcSeries }).series;
  const ispMap = ispByNormalizedName(ano);
  const rows: RjGovernanceRow[] = [];

  for (const [mun, anos] of Object.entries(fc)) {
    const s = anos[ano];
    if (!s || s.oc === 0) continue;
    const disputaShare = s.disputa / s.oc;
    const robusto = s.oc >= ROBUSTO_MIN_TIROTEIOS;
    const i = ispMap.get(normalizeName(mun)) ?? null;
    rows.push({
      municipio: mun,
      tiroteios: s.oc,
      disputa: s.disputa,
      disputaShare: Math.round(disputaShare * 1000) / 1000,
      mortosTiroteio: s.mortos,
      letalidade: i?.letalidade ?? null,
      extorsao: i?.extorsao ?? null,
      trafico: i?.trafico ?? null,
      desaparecidos: i?.desaparecidos ?? null,
      classificacao: classifica(disputaShare, robusto),
      robusto,
    });
  }

  return rows.sort((a, b) => {
    if (ordem[a.classificacao] !== ordem[b.classificacao]) return ordem[a.classificacao] - ordem[b.classificacao];
    if (a.classificacao === "controle") return (b.extorsao ?? 0) - (a.extorsao ?? 0);
    return b.tiroteios - a.tiroteios;
  });
}
