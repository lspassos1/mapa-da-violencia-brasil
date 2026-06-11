import { riskColors } from "@/lib/colorScale";
import { riskLevelLabels } from "@/lib/riskLevel";
import type { RiskLevel, ViewMode } from "@/types/crime";

const legend: Array<{ level: RiskLevel; range: string }> = [
  { level: "baixo", range: "0-20" },
  { level: "moderado", range: "21-40" },
  { level: "atencao", range: "41-60" },
  { level: "alto", range: "61-80" },
  { level: "critico", range: "81-100" },
];

// Faixas da escala DIVERGENTE do modo "variacao anual" (vs ano anterior).
// Mesmas cores de getVariationColor (geoService).
const variationLegend = [
  { color: "#15803d", range: "≤ -25%", label: "Forte queda" },
  { color: "#4ade80", range: "-25 a -5%", label: "Queda" },
  { color: "#94a3b8", range: "±5%", label: "Estavel" },
  { color: "#fb923c", range: "+5 a +25%", label: "Subida" },
  { color: "#dc2626", range: "≥ +25%", label: "Forte subida" },
];

export function MapLegend({ viewMode = "score" }: { viewMode?: ViewMode }) {
  if (viewMode === "variacaoAnual") {
    return (
      <div className="w-[260px] rounded-lg border border-white/10 bg-slate-950/80 p-4 text-xs shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-slate-100">Legenda</p>
          <p className="text-slate-400">variacao anual</p>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {variationLegend.map((item) => (
            <div key={item.range} className="space-y-1">
              <div className="h-2 rounded-full" style={{ background: item.color }} />
              <p className="text-[10px] text-slate-400">{item.range}</p>
              <p className="truncate text-[10px] text-slate-200">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-snug text-slate-400">
          Variação do total face ao <span className="text-slate-200">ano anterior</span>. Cinza =
          sem variação calculável (primeiro ano da série ou{" "}
          <span className="text-slate-200">ano parcial</span> — compare anos completos; a leitura
          mês-a-mês do ano corrente vive na aba Tendências).
        </p>
      </div>
    );
  }

  return (
    <div className="w-[260px] rounded-lg border border-white/10 bg-slate-950/80 p-4 text-xs shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-slate-100">Legenda</p>
        <p className="text-slate-400">score 0-100</p>
      </div>
      <div className="mb-3 h-2 rounded-full bg-gradient-to-r from-[#22c55e] via-[#eab308] via-[#f97316] to-[#7f1d1d]" />
      <div className="grid grid-cols-5 gap-1">
        {legend.map((item) => (
          <div key={item.level} className="space-y-1">
            <div className="h-2 rounded-full" style={{ background: riskColors[item.level] }} />
            <p className="text-[10px] text-slate-400">{item.range}</p>
            <p className="truncate text-[10px] text-slate-200">{riskLevelLabels[item.level]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-snug text-slate-400">
        No nível nacional, o <span className="text-slate-200">preenchimento dos estados</span> é um
        degradê que ordena as UFs do menor para o maior nível de violência. Clique num estado para
        ampliar e ver os <span className="text-slate-200">municípios</span> com fronteiras reais,
        coloridos pelo seu índice no indicador e período selecionados.
      </p>
    </div>
  );
}
