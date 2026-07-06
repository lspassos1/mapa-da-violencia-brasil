"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { NewsMap } from "@/components/news/NewsMap";
import { NEWS_TYPE_LABEL, REVIEW_LABEL, confidenceColor, confidencePct } from "@/lib/newsDisplay";
import type { NewsIncident, NewsIncidentType, NewsReviewStatus } from "@/types/news";

interface ApiResponse {
  incidents: NewsIncident[];
  meta: {
    disclaimer: string;
    official: boolean;
    // Stats ao-vivo trazem contagens de ingestao; as persistidas, so o conjunto.
    stats?: {
      artigos?: number;
      extraidos?: number;
      descartados?: number;
      deduplicados?: number;
      fontesTotais?: number;
      incidentesMultiFonte?: number;
      porProvedor?: Record<string, number>;
      provedores?: number;
      total?: number;
    };
    fonte?: string; // "ao-vivo" | "persistido"
    janelaDias?: number;
    geradoEm?: string;
  };
}

export function NewsDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState<NewsIncidentType | "todos">("todos");
  const [minConf, setMinConf] = useState(0);
  const [soGeo, setSoGeo] = useState(false);
  const [revisao, setRevisao] = useState<NewsReviewStatus | "todos">("todos");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/news-incidents");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial: o estado so e atualizado apos o await (sem setState sincrono
  // no efeito) e e ignorado se o componente desmontar antes de resolver.
  useEffect(() => {
    let active = true;
    fetch("/api/news-incidents")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => active && setData(json as ApiResponse))
      .catch((e) => active && setErro(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const incidents = useMemo(() => data?.incidents ?? [], [data]);
  const filtrados = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (tipo === "todos" || i.tipo === tipo) &&
          i.confianca >= minConf &&
          (!soGeo || i.idIbge !== null) &&
          (revisao === "todos" || i.reviewStatus === revisao),
      ),
    [incidents, tipo, minConf, soGeo, revisao],
  );
  const tiposPresentes = useMemo(
    () => Array.from(new Set(incidents.map((i) => i.tipo))),
    [incidents],
  );

  function focar(id: string) {
    setSelecionado(id);
    cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="flex min-h-screen flex-col text-ink">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4">
        {/* Cabecalho da aba */}
        <div className="flex items-center gap-2 text-sec">
          <Newspaper className="h-5 w-5" />
          <h2 className="text-lg font-semibold tracking-wide text-ink">Notícias / OSINT</h2>
        </div>

        {/* Aviso inegociavel: indicios, nao base oficial */}
        <div className="flex items-start gap-2 rounded-lg border border-[rgba(226,163,59,.35)] bg-[rgba(226,163,59,.05)] px-4 py-3 text-sm text-indiciotx">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Indícios extraídos de notícias por IA</strong> — não verificados e{" "}
            <strong>não são estatística oficial</strong>. Cada item traz a fonte, o link original e um nível de
            confiança. Para os dados oficiais consolidados, use o{" "}
            <Link className="underline hover:text-ink" href="/mapa">
              mapa principal
            </Link>
            .
          </p>
        </div>

        {/* Barra de filtros + stats */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-ter">Tipo</span>
            <select
              className="rounded-md border border-line bg-panel px-2 py-1 text-ink"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as NewsIncidentType | "todos")}
            >
              <option value="todos">Todos</option>
              {tiposPresentes.map((t) => (
                <option key={t} value={t}>
                  {NEWS_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ter">Confiança ≥ {confidencePct(minConf)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={soGeo} onChange={(e) => setSoGeo(e.target.checked)} />
            <span className="text-ter">Só geolocalizados</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ter">Revisão</span>
            <select
              className="rounded-md border border-line bg-panel px-2 py-1 text-ink"
              value={revisao}
              onChange={(e) => setRevisao(e.target.value as NewsReviewStatus | "todos")}
            >
              <option value="todos">Todas</option>
              <option value="confirmado">{REVIEW_LABEL.confirmado}</option>
              <option value="pendente">{REVIEW_LABEL.pendente}</option>
              <option value="rejeitado">{REVIEW_LABEL.rejeitado}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={carregar}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:border-edgehover hover:text-ink"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {data?.meta ? (
          <p className="text-xs text-ink0">
            {filtrados.length} de {incidents.length} indícios ·{" "}
            {incidents.filter((i) => i.idIbge).length} geolocalizados ·{" "}
            {incidents.filter((i) => i.corroboracao > 1).length} com múltiplas fontes
            {data.meta.stats?.provedores ? ` · ${data.meta.stats.provedores} provedor(es) de IA` : ""}
            {typeof data.meta.stats?.artigos === "number"
              ? ` · de ${data.meta.stats.artigos} notícias (${data.meta.stats.descartados ?? 0} descartadas como não-crime)`
              : ""}
            {data.meta.fonte === "persistido" ? ` · acumulado (janela ${data.meta.janelaDias}d)` : ""}
          </p>
        ) : null}

        {/* Conteudo: mapa + feed */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-h-[320px] overflow-hidden rounded-xl border border-line bg-panel/40">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-ter">A carregar…</div>
            ) : (
              <NewsMap incidents={filtrados} onSelect={focar} />
            )}
          </div>

          <ul className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {erro ? (
              <li className="rounded-lg border border-[rgba(229,83,61,.3)] bg-[rgba(229,83,61,.08)] p-3 text-sm text-[#F0B0B3]">
                Falha ao carregar: {erro}
              </li>
            ) : null}
            {!loading && filtrados.length === 0 && !erro ? (
              <li className="rounded-lg border border-line p-4 text-sm text-ter">
                Nenhum indício no filtro atual.
              </li>
            ) : null}
            {filtrados.map((i) => (
              <li
                key={i.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(i.id, el);
                  else cardRefs.current.delete(i.id);
                }}
                className={`rounded-lg border p-3 transition ${
                  selecionado === i.id ? "border-ink bg-[rgba(236,234,228,.05)]" : "border-line bg-panel"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{NEWS_TYPE_LABEL[i.tipo]}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-bg0"
                    style={{ background: confidenceColor(i.confianca) }}
                    title={`Confiança ${confidencePct(i.confianca)} · ${REVIEW_LABEL[i.reviewStatus]}`}
                  >
                    {confidencePct(i.confianca)} · {REVIEW_LABEL[i.reviewStatus]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ter">
                  {i.idIbge ? `${i.municipio}/${i.uf}` : "Local não identificado"}
                  {i.dataOcorrencia ? ` · ${i.dataOcorrencia}` : ""}
                  {typeof i.vitimas === "number" ? ` · ${i.vitimas} vítima(s)` : ""}
                </p>
                <p className="mt-1 text-sm text-ink">{i.resumo}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink0">
                  <span>
                    {i.veiculo} · extraído por {i.provedor}
                  </span>
                  <a
                    className="inline-flex items-center gap-1 text-sec hover:text-ink"
                    href={i.fonteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ver notícia <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {i.fontes.length > 1 ? (
                  <details className="mt-1.5 text-[11px] text-ink0">
                    <summary className="cursor-pointer text-indiciotx hover:text-indiciotx">
                      +{i.fontes.length - 1} fonte(s) corroborando
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-1">
                      {i.fontes.map((f) => (
                        <li key={f.fonteUrl} className="flex items-center justify-between gap-2">
                          <span className="truncate">{f.veiculo}</span>
                          <a
                            className="inline-flex shrink-0 items-center gap-1 text-sec hover:text-ink"
                            href={f.fonteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            ver <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
