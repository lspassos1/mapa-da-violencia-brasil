// Radar de anomalia — LENTE 3 (#85, eixo 3): homicídios potencialmente OCULTOS.
//
// "Assinatura de ouro" da subnotificação/reclassificação (literatura): o homicídio
// registrado (CID X85–Y09) CAI enquanto a "morte por intenção indeterminada"/MVCI
// (Y10–Y34) SOBE — ~43,6% das MVCI eram de fato homicídios (SciELO 2025). Quando as
// duas coisas andam juntas numa UF, parte da queda do homicídio pode ser apenas
// reclassificação, não redução real da violência.
//
// Dados: SIM/DATASUS (DO), gerados OFFLINE por etl/build_hidden_homicides.py
// (FTP pesado, não roda no CI) -> src/data/hiddenHomicides.json. Enquanto o asset
// não é gerado, a série fica vazia e a lente reporta "dados pendentes" (degradação
// graciosa). ⚠️ INDÍCIO, nunca acusação. Ver §literatura no #85.
import "server-only";
import asset from "@/data/hiddenHomicides.json";

interface YearStat {
  homicidios: number;
  mvci: number;
  total: number;
  razaoMvci: number | null;
}
interface HiddenAsset {
  fonte: string;
  cids: { homicidio: string; mvci: string };
  series: Record<string, Record<string, YearStat>>;
}

export const HIDDEN_SOURCE = (asset as HiddenAsset).fonte;

// Limiares da assinatura de ouro (documentados p/ transparência).
const HOM_QUEDA_MIN = -0.05; // homicídio cai ≥5% (2ª metade vs 1ª)
const RAZAO_ALTA_MIN = 0.005; // razão MVCI sobe ≥0,5 p.p.
const ROBUSTO_MIN_ANOS = 4; // poucos anos -> tendência ruidosa
const ROBUSTO_MIN_HOM = 50; // poucos homicídios/ano -> razão ruidosa

export type SinalOculto = "indicio_oculto" | "neutro";

export interface HiddenUfRow {
  uf: string;
  anos: number;
  homInicial: number; // média de homicídios na 1ª metade do período
  homFinal: number; // 2ª metade
  homPct: number; // variação relativa (negativo = caiu)
  razaoInicial: number | null;
  razaoFinal: number | null;
  razaoDelta: number | null; // razaoFinal - razaoInicial (positivo = MVCI subiu)
  sinal: SinalOculto;
  robusto: boolean;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const round = (n: number, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas;

// Calcula a assinatura de ouro de UMA UF (puro/testável). Compara a 1ª metade do
// período com a 2ª (descarta o ano do meio se ímpar, p/ contraste): homicídio
// caindo E razão MVCI subindo = indício de homicídio oculto.
export function computeHiddenSignal(
  uf: string,
  serie: Record<string, YearStat>,
): HiddenUfRow {
  const anosOrd = Object.keys(serie)
    .map(Number)
    .filter((a) => Number.isFinite(a))
    .sort((a, b) => a - b);
  const stats = anosOrd.map((a) => serie[String(a)]);
  const n = stats.length;
  const mid = Math.floor(n / 2);
  const primeira = stats.slice(0, mid);
  const segunda = stats.slice(n - mid); // mesmo tamanho; descarta o meio se ímpar

  const homInicial = mean(primeira.map((s) => s.homicidios));
  const homFinal = mean(segunda.map((s) => s.homicidios));
  const homPct = homInicial > 0 ? round((homFinal - homInicial) / homInicial) : 0;

  const razoes = (arr: YearStat[]) => arr.map((s) => s.razaoMvci).filter((r): r is number => r != null);
  const rIni = razoes(primeira);
  const rFim = razoes(segunda);
  const razaoInicial = rIni.length ? round(mean(rIni)) : null;
  const razaoFinal = rFim.length ? round(mean(rFim)) : null;
  const razaoDelta = razaoInicial != null && razaoFinal != null ? round(razaoFinal - razaoInicial) : null;

  const robusto = n >= ROBUSTO_MIN_ANOS && homInicial >= ROBUSTO_MIN_HOM;
  const gold =
    robusto && homPct <= HOM_QUEDA_MIN && razaoDelta != null && razaoDelta >= RAZAO_ALTA_MIN;

  return {
    uf,
    anos: n,
    homInicial: Math.round(homInicial),
    homFinal: Math.round(homFinal),
    homPct,
    razaoInicial,
    razaoFinal,
    razaoDelta,
    sinal: gold ? "indicio_oculto" : "neutro",
    robusto,
  };
}

export interface HiddenHomicidesResult {
  pendente: boolean; // asset ainda não gerado (rodar o ETL do DATASUS)
  fonte: string;
  ufs: HiddenUfRow[];
}

// Lente 3 por UF. Ordena: indício oculto primeiro, depois maior alta de MVCI.
// pendente=true quando a série está vazia (asset não gerado).
export function getHiddenHomicides(): HiddenHomicidesResult {
  const series = (asset as HiddenAsset).series ?? {};
  const ufs = Object.keys(series)
    .filter((uf) => Object.keys(series[uf]).length > 0)
    .map((uf) => computeHiddenSignal(uf, series[uf]));
  ufs.sort((a, b) => {
    if (a.sinal !== b.sinal) return a.sinal === "indicio_oculto" ? -1 : 1;
    return (b.razaoDelta ?? -1) - (a.razaoDelta ?? -1);
  });
  return { pendente: ufs.length === 0, fonte: (asset as HiddenAsset).fonte, ufs };
}
