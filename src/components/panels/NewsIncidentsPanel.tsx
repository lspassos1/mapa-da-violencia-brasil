import { ExternalLink, Newspaper, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { getNewsConfidenceLabel, getNewsIncidentTypeLabel } from "@/lib/newsIncidents";
import type { NewsDataStatus, NewsIncident, NewsIncidentSummary } from "@/types/news";

interface NewsIncidentsPanelProps {
  incidents: NewsIncident[];
  selectedIncident: NewsIncident | null;
  status: NewsDataStatus;
  summary: NewsIncidentSummary;
  onSelect: (incident: NewsIncident) => void;
}

export function NewsIncidentsPanel({
  incidents,
  selectedIncident,
  status,
  summary,
  onSelect,
}: NewsIncidentsPanelProps) {
  if (selectedIncident) {
    return (
      <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Noticia OSINT</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{selectedIncident.municipality}</h2>
            <p className="text-sm text-slate-300">
              {selectedIncident.state} / {selectedIncident.uf}
            </p>
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-slate-950 px-3 py-2 text-right">
            <p className="text-xs text-slate-500">Confianca</p>
            <p className="font-semibold text-amber-100">
              {getNewsConfidenceLabel(selectedIncident.confidenceLevel)} {Math.round(selectedIncident.confidence * 100)}%
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
          <p className="font-semibold text-slate-100">{selectedIncident.title}</p>
          <p>{selectedIncident.summary}</p>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-slate-950/70 p-3">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Tipo</dt>
              <dd className="mt-1 text-slate-100">{getNewsIncidentTypeLabel(selectedIncident.type)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Data</dt>
              <dd className="mt-1 text-slate-100">{formatDate(selectedIncident.occurredAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Fonte</dt>
              <dd className="mt-1 text-slate-100">{selectedIncident.sourceName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Revisao</dt>
              <dd className="mt-1 text-slate-100">{selectedIncident.status}</dd>
            </div>
          </dl>
          <a
            className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-200"
            href={selectedIncident.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir fonte
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-5 backdrop-blur">
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-amber-200" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-200">Noticias OSINT</h2>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Casos" value={String(summary.total)} />
        <Metric label="Alta conf." value={String(summary.highConfidence)} />
        <Metric label="Fontes" value={String(summary.sources)} />
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm leading-6 text-slate-400">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-100">
          <ShieldCheck className="h-4 w-4 text-amber-200" />
          {status.source}
        </div>
        <p>Registros de noticias sao indicios demonstrativos e ficam separados dos dados oficiais.</p>
      </div>

      <div className="mt-4 space-y-2">
        {incidents.slice(0, 4).map((incident) => (
          <button
            key={incident.id}
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 p-3 text-left transition hover:border-amber-300/40"
            type="button"
            onClick={() => onSelect(incident)}
          >
            <p className="text-sm font-semibold text-slate-100">
              {incident.municipality} / {incident.uf}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{incident.title}</p>
          </button>
        ))}
        {incidents.length === 0 ? <p className="text-sm text-slate-400">Nenhuma noticia neste recorte.</p> : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
