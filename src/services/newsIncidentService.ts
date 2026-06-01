import { mockNewsIncidents, newsDataStatus, newsIncidentTypeOptions } from "@/data/mockNewsIncidents";
import type {
  NewsIncident,
  NewsIncidentFilters,
  NewsIncidentResult,
  NewsIncidentReviewStatus,
  NewsIncidentType,
  NewsIncidentTypeFilter,
  NewsIncidentTypeOption,
} from "@/types/news";

const defaultFilters: NewsIncidentFilters = {
  period: newsDataStatus.latestPeriod === "Abr/2026" ? "2026-04" : mockNewsIncidents[0]?.period ?? "2026-04",
  uf: null,
  type: "todos",
  minConfidence: 0.6,
  status: "revisado",
};

export function getDefaultNewsIncidentFilters(): NewsIncidentFilters {
  return { ...defaultFilters };
}

export function getAvailableNewsIncidentTypes(): NewsIncidentTypeOption[] {
  return [...newsIncidentTypeOptions];
}

export function getNewsDataStatus() {
  return newsDataStatus;
}

export function getNewsIncidentData(filters: Partial<NewsIncidentFilters> = {}): NewsIncidentResult {
  const resolved = resolveFilters(filters);
  const items = mockNewsIncidents.filter((incident) => matchesFilters(incident, resolved));
  const sourceCount = new Set(items.map((incident) => incident.sourceName)).size;

  return {
    demo: true,
    status: newsDataStatus,
    filters: resolved,
    items,
    summary: {
      total: items.length,
      highConfidence: items.filter((incident) => incident.confidenceLevel === "alta").length,
      sources: sourceCount,
      reviewed: items.filter((incident) => incident.status === "revisado").length,
    },
  };
}

export function isNewsIncidentType(value: string): value is NewsIncidentType {
  return newsIncidentTypeOptions.some((option) => option.key === value && option.key !== "todos");
}

export function isNewsIncidentTypeFilter(value: string): value is NewsIncidentTypeFilter {
  return value === "todos" || isNewsIncidentType(value);
}

export function isNewsIncidentReviewStatus(value: string): value is NewsIncidentReviewStatus {
  return ["pendente", "revisado", "descartado"].includes(value);
}

export function isNewsIncidentReviewStatusFilter(value: string): value is NewsIncidentReviewStatus | "todos" {
  return value === "todos" || isNewsIncidentReviewStatus(value);
}

function resolveFilters(filters: Partial<NewsIncidentFilters>): NewsIncidentFilters {
  return {
    period: filters.period ?? defaultFilters.period,
    uf: filters.uf ? filters.uf.toUpperCase() : defaultFilters.uf,
    type: filters.type ?? defaultFilters.type,
    minConfidence: filters.minConfidence ?? defaultFilters.minConfidence,
    status: filters.status ?? defaultFilters.status,
  };
}

function matchesFilters(incident: NewsIncident, filters: NewsIncidentFilters): boolean {
  return (
    incident.period === filters.period &&
    (!filters.uf || incident.uf === filters.uf) &&
    (filters.type === "todos" || incident.type === filters.type) &&
    incident.confidence >= filters.minConfidence &&
    (filters.status === "todos" || incident.status === filters.status)
  );
}
