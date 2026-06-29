"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Crosshair, MapPin, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ShootingsMap, CONTEXTO_COR, CONTEXTO_LABEL } from "@/components/radar/ShootingsMap";
import type { Contexto, DiaResumo, MunicipioResumoFull, ShootingOccurrence } from "@/server/shootings/fogocruzado";
import type { OsintPoint } from "@/server/shootings/crossref";

interface ApiResponse {
  ocorrencias: ShootingOccurrence[];
  meta: {
    fonte: string;
    cobertura?: string;
    dias?: number;
    disclaimer: string;
    total?: number;
    porContexto?: Record<Contexto, number>;
    porMunicipio?: MunicipioResumoFull[];
    historico?: DiaResumo[];
    osint?: OsintPoint[];
    osintUfs?: number;
    mortos?: number;
    aviso?: string;
  };
}


// Distância em km entre dois pontos (Haversine) — p/ "perto de mim".
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function TiroteiosDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contexto, setContexto] = useState<Contexto | "todos">("todos");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  function pertoDeMim() {
    if (!("geolocation" in navigator)) {
      setGeoMsg("Geolocalização indisponível neste navegador.");
      return;
    }
    setGeoMsg("Localizando…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoMsg(null);
      },
      (err) => setGeoMsg(err.code === err.PERMISSION_DENIED ? "Permissão de localização negada." : "Não foi possível obter sua localização."),
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/shootings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/shootings")
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

  const todas = useMemo(() => data?.ocorrencias ?? [], [data]);
  const filtradas = useMemo(
    () =>
      [...todas]
        .filter((o) => contexto === "todos" || o.contexto === contexto)
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [todas, contexto],
  );

  // "Perto de mim": evento mais próximo do usuário. Preserva a CLASSE da fonte
  // (registro Fogo Cruzado × indício de notícia OSINT) — nunca rotular OSINT como
  // "registro" oficial (moldura inegociável: indício ≠ registro).
  const maisProximo = useMemo(() => {
    if (!userPos) return null;
    const pontos: { lat: number; lng: number; rotulo: string; kind: "fc" | "osint" }[] = [
      ...todas.filter((o) => typeof o.lat === "number" && typeof o.lng === "number").map((o) => ({ lat: o.lat as number, lng: o.lng as number, rotulo: `${o.municipio}/${o.estado}`, kind: "fc" as const })),
      ...(data?.meta.osint ?? []).map((p) => ({ lat: p.lat, lng: p.lng, rotulo: `${p.municipio}/${p.uf}`, kind: "osint" as const })),
    ];
    let best: { rotulo: string; km: number; kind: "fc" | "osint" } | null = null;
    for (const pt of pontos) {
      const km = haversineKm(userPos, pt);
      if (!best || km < best.km) best = { rotulo: pt.rotulo, km, kind: pt.kind };
    }
    return best;
  }, [userPos, todas, data]);

  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-cyan-300">
          <Crosshair className="h-5 w-5" />
          <h2 className="text-lg font-semibold tracking-wide text-slate-100">Radar de tiroteios — tempo quase real</h2>
          <Link href="/radar" className="ml-auto text-xs text-slate-400 underline hover:text-cyan-200">
            ← radar de anomalia
          </Link>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Não é alerta de emergência</strong> — em urgências, ligue 190. Registros de tiroteios/disparos da{" "}
            <a className="underline hover:text-amber-50" href="https://fogocruzado.org.br" target="_blank" rel="noopener noreferrer">
              Fogo Cruzado
            </a>{" "}
            (últimos {data?.meta.dias ?? 7} dias). <strong>Cobertura ao vivo</strong>:{" "}
            {data?.meta.cobertura ?? "regiões metropolitanas de Rio de Janeiro, Recife, Salvador e Belém"}. Fora delas, o mapa
            mostra <strong>◆ indícios de notícias (OSINT)</strong> no Brasil todo
            {data?.meta.osintUfs ? ` (${data.meta.osintUfs} UF[s] no momento)` : ""} — precisão municipal, indício, não registro.
          </p>
        </div>

        {/* filtros + stats */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Contexto</span>
            <select
              className="rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-slate-100"
              value={contexto}
              onChange={(e) => setContexto(e.target.value as Contexto | "todos")}
            >
              <option value="todos">Todos</option>
              <option value="disputa">{CONTEXTO_LABEL.disputa}</option>
              <option value="policia">{CONTEXTO_LABEL.policia}</option>
              <option value="outro">{CONTEXTO_LABEL.outro}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {(["disputa", "policia", "outro"] as Contexto[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXTO_COR[c] }} />
                {CONTEXTO_LABEL[c]}: {data?.meta.porContexto?.[c] ?? 0}
              </span>
            ))}
            <span className="inline-flex items-center gap-1" title="Indícios de violência armada extraídos de notícias (OSINT), nacional, precisão municipal">
              <span className="inline-block h-2.5 w-2.5 rotate-45 border border-amber-500 bg-amber-500/20" />
              Notícia (OSINT): {data?.meta.osint?.length ?? 0}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={pertoDeMim}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${userPos ? "border-blue-400/50 text-blue-200" : "border-white/10 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"}`}
            >
              <MapPin className="h-3.5 w-3.5" /> Perto de mim
            </button>
            <button
              type="button"
              onClick={carregar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-300/50 hover:text-cyan-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </div>

        {data?.meta ? (
          <p className="text-xs text-slate-500">
            {filtradas.length} de {todas.length} ocorrências · {data.meta.mortos ?? 0} morto(s) na janela ·{" "}
            {todas.filter((o) => typeof o.lat === "number").length} no mapa
            {data.meta.fonte ? ` · fonte: ${data.meta.fonte}` : ""}
            {data.meta.aviso ? ` · ${data.meta.aviso}` : ""}
          </p>
        ) : null}

        {/* Região viva: status da geolocalização e resultado são anunciados a leitores de
            tela. Caixa real (flex) — não `display:contents`, que pode sumir da árvore de
            acessibilidade e silenciar o aria-live (Chromium+NVDA). `empty:hidden` evita
            o gap extra quando não há mensagem. */}
        <div role="status" aria-live="polite" className="flex flex-col gap-4 empty:hidden">
          {geoMsg ? <p className="text-xs text-slate-400">{geoMsg}</p> : null}
          {maisProximo ? (
            <p className="rounded-lg border border-blue-400/20 bg-blue-400/5 px-3 py-2 text-xs text-blue-100">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />{" "}
              {maisProximo.kind === "fc"
                ? "Registro mais próximo de você: "
                : "Indício de notícia mais próximo de você: "}
              <strong>{maisProximo.rotulo}</strong>
              {maisProximo.kind === "osint" ? " (precisão municipal)" : ""} · ~
              {maisProximo.km < 1 ? "<1" : Math.round(maisProximo.km)} km. Não é alerta de emergência.
            </p>
          ) : null}
          {userPos && !maisProximo ? (
            <p className="text-xs text-slate-400">
              Localização obtida, mas nenhum registro/indício geolocalizado na janela atual.
            </p>
          ) : null}
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-h-[360px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">A carregar…</div>
            ) : (
              <ShootingsMap ocorrencias={filtradas} osint={contexto === "todos" ? (data?.meta.osint ?? []) : []} focus={userPos} />
            )}
          </div>

          <ul className="max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {erro ? (
              <li className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">Falha ao carregar: {erro}</li>
            ) : null}
            {!loading && filtradas.length === 0 && !erro ? (
              <li className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">Nenhuma ocorrência no filtro atual.</li>
            ) : null}
            {filtradas.slice(0, 200).map((o) => (
              <li key={o.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CONTEXTO_COR[o.contexto] }} />
                    {CONTEXTO_LABEL[o.contexto]}
                  </span>
                  <span className="text-[11px] text-slate-500">{o.data.slice(0, 10)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {o.bairro ? `${o.bairro} — ` : ""}
                  {o.municipio}/{o.estado}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {o.mortos} morto(s) · {o.feridos} ferido(s){o.mainReason ? ` · ${o.mainReason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Tendência histórica acumulada (cron → Supabase) */}
        {data?.meta.historico && data.meta.historico.length > 1 ? (
          <TrendStrip dados={data.meta.historico} />
        ) : null}

        {/* Análise por município (+ overlay da lente 2 no RJ) */}
        {data?.meta.porMunicipio?.length ? (
          <div className="mt-2">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">
              Por município <span className="font-normal text-slate-500">— tiroteios na janela + cobertura na imprensa (OSINT)</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Município</th>
                    <th className="px-3 py-2">Tiroteios</th>
                    <th className="px-3 py-2" title="% dos tiroteios por disputa entre grupos">% disputa</th>
                    <th className="px-3 py-2">Mortos</th>
                    <th className="px-3 py-2" title="Notícias OSINT no município (indício, não fato)">Imprensa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.meta.porMunicipio.slice(0, 25).map((m) => (
                    <tr key={`${m.municipio}|${m.estado}`} className="border-t border-white/5">
                      <td className="px-3 py-2 font-medium text-slate-100">
                        {m.municipio}
                        <span className="text-slate-500"> / {m.estado}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{m.total}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{(m.disputaShare * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-slate-400">{m.mortos}</td>
                      <td className="px-3 py-2">
                        {m.noticias.length ? (
                          <details className="group">
                            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200">
                              📰 {m.noticias.length} <span className="text-slate-500 group-open:hidden">▸</span>
                            </summary>
                            <ul className="mt-1 space-y-1">
                              {m.noticias.map((n, i) => (
                                <li key={`${n.url}|${i}`} className="text-[11px] leading-tight">
                                  {n.url ? (
                                    <a className="text-slate-300 underline hover:text-cyan-200" href={n.url} target="_blank" rel="noopener noreferrer">
                                      {n.titulo}
                                    </a>
                                  ) : (
                                    <span className="text-slate-300">{n.titulo}</span>
                                  )}
                                  <span className="text-slate-500">
                                    {n.veiculo ? ` · ${n.veiculo}` : ""}
                                    {n.data ? ` · ${n.data}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              &quot;Imprensa&quot; liga ao acervo de{" "}
              <Link className="underline hover:text-cyan-200" href="/noticias">notícias OSINT</Link> do município (cobertura cresce com o tempo). A leitura
              de governança (controle×disputa) <strong>por UF</strong> está no{" "}
              <Link className="underline hover:text-cyan-200" href="/radar">radar de anomalia</Link>. Indício, não acusação.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// Tira de barras diárias (tendência acumulada no banco). Altura ∝ tiroteios/dia;
// barras com morto(s) recebem topo âmbar. Cresce de ~7 dias (janela viva) até 30.
function TrendStrip({ dados }: { dados: DiaResumo[] }) {
  const max = Math.max(1, ...dados.map((d) => d.total));
  const totalJanela = dados.reduce((s, d) => s + d.total, 0);
  const mortosJanela = dados.reduce((s, d) => s + d.mortos, 0);
  return (
    <div className="mt-2">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">
        Tendência <span className="font-normal text-slate-500">— tiroteios/dia acumulados ({dados.length} dia(s) · {totalJanela} tiroteios · {mortosJanela} mortos)</span>
      </h3>
      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
        <div className="flex h-24 items-end gap-0.5">
          {dados.map((d) => (
            <div
              key={d.dia}
              className="flex-1 rounded-t-sm bg-cyan-500/40"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
              title={`${d.dia}: ${d.total} tiroteio(s) · ${d.mortos} morto(s)`}
            >
              {d.mortos > 0 ? <div className="h-1 rounded-t-sm bg-amber-300/80" /> : null}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>{dados[0]?.dia}</span>
          <span>{dados[dados.length - 1]?.dia}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Histórico persistido a cada ingestão (cron diário + refresh sob demanda). A janela cresce com o tempo.
      </p>
    </div>
  );
}
