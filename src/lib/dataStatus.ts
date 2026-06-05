import type { DataAvailabilityStatus } from "@/types/crime";

// Rotulos curtos e descricoes para cada estado de disponibilidade do dado.
// Centralizado para que mapa, tooltip e painel de detalhes falem a mesma lingua
// e a ausencia de dado nunca seja confundida com zero.
const STATUS_LABELS: Record<DataAvailabilityStatus, string> = {
  oficial: "Oficial",
  amostra_oficial: "Amostra oficial",
  demo: "Demonstrativo",
  sem_dados: "Sem dados",
  zero_registrado: "Zero registrado",
  populacao_indisponivel: "Taxa indisponivel",
  nao_aplicavel: "Nao aplicavel",
};

const STATUS_DESCRIPTIONS: Record<DataAvailabilityStatus, string> = {
  oficial: "Dado oficial processado.",
  amostra_oficial: "Amostra oficial versionada (parcial).",
  demo: "Valor demonstrativo, nao representa dado real.",
  sem_dados: "Sem dado para este municipio e periodo.",
  zero_registrado: "Zero ocorrencias registradas (nao e ausencia de dado).",
  populacao_indisponivel:
    "Taxa por 100 mil indisponivel: populacao de ano diferente do indicador.",
  nao_aplicavel: "Indicador nao aplicavel a este recorte.",
};

export function getDataStatusLabel(status: DataAvailabilityStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getDataStatusDescription(status: DataAvailabilityStatus): string {
  return STATUS_DESCRIPTIONS[status] ?? "";
}

// true quando o estado representa ausencia/indisponibilidade (para estilizar
// como aviso, nunca como valor baixo).
export function isUnavailableStatus(status: DataAvailabilityStatus): boolean {
  return status === "sem_dados" || status === "nao_aplicavel" || status === "populacao_indisponivel";
}
