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
// Mesmas cores de getVariationColor (geoService): verde só p/ queda.
const variationLegend = [
  { color: "#2E7A54", range: "≤ -25%", label: "Forte queda" },
  { color: "#58B37E", range: "-25 a -5%", label: "Queda" },
  { color: "#565B63", range: "±5%", label: "Estavel" },
  { color: "#B03D2C", range: "+5 a +25%", label: "Subida" },
  { color: "#E5533D", range: "≥ +25%", label: "Forte subida" },
];

export function MapLegend({ viewMode = "score" }: { viewMode?: ViewMode }) {
  if (viewMode === "variacaoAnual") {
    return (
      <div className="w-[260px] border border-edge bg-[rgba(12,13,16,.9)] p-4 text-xs backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[9px] tracking-[.2em] text-quat">LEGENDA</p>
          <p className="font-mono text-[9px] tracking-[.12em] text-ter">VARIAÇÃO ANUAL</p>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {variationLegend.map((item) => (
            <div key={item.range} className="space-y-1">
              <div className="h-2" style={{ background: item.color }} />
              <p className="font-mono text-[9px] text-quat">{item.range}</p>
              <p className="truncate text-[10px] text-sec">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-hair pt-2 text-[10px] leading-snug text-ter">
          Variação do total face ao <span className="text-sec">ano anterior</span>. Cinza = sem variação calculável
          (primeiro ano da série ou <span className="text-sec">ano parcial</span> — compare anos completos; a leitura
          mês-a-mês do ano corrente vive na aba Tendências).
        </p>
      </div>
    );
  }

  return (
    <div className="w-[260px] border border-edge bg-[rgba(12,13,16,.9)] p-4 text-xs backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[9px] tracking-[.2em] text-quat">LEGENDA</p>
        <p className="font-mono text-[9px] tracking-[.12em] text-ter">SCORE 0-100</p>
      </div>
      <div
        className="mb-3 h-2"
        style={{ background: "linear-gradient(90deg, #23272E, #4B2C2A, #7A342C, #B03D2C, #E5533D)" }}
      />
      <div className="grid grid-cols-5 gap-1">
        {legend.map((item) => (
          <div key={item.level} className="space-y-1">
            <div className="h-2" style={{ background: riskColors[item.level] }} />
            <p className="font-mono text-[9px] text-quat">{item.range}</p>
            <p className="truncate text-[10px] text-sec">{riskLevelLabels[item.level]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-hair pt-2 text-[10px] leading-snug text-ter">
        No nível nacional, o <span className="text-sec">preenchimento dos estados</span> é um degradê que ordena as UFs
        do menor para o maior nível de violência. Clique num estado para ampliar e ver os{" "}
        <span className="text-sec">municípios</span> com fronteiras reais, coloridos pelo seu índice no indicador e
        período selecionados.
      </p>
    </div>
  );
}
