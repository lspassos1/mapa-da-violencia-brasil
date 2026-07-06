"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

// Série nacional (SINESP/VDE) calculada no servidor e passada por props.
export interface SerieNacional {
  labels: string[]; // "2015-01" … "2026-04"
  vals: number[];
}

type Filtro = Contexto | "todos" | "osint";

const INDICIO = "#E2A33B";
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Distância em km entre dois pontos (Haversine) — p/ "perto de mim".
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function tempoLabel(iso: string | null, now: number): string {
  if (!iso) return "";
  const h = Math.max(0, Math.floor((now - Date.parse(iso)) / 3600000));
  if (h < 1) return "agora";
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

export function TiroteiosDashboard({ nacional }: { nacional: SerieNacional }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  // instante da última carga — base dos rótulos "há N h" (nunca Date.now() em render)
  const [agora, setAgora] = useState(0);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/shootings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
      setAgora(Date.now());
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
      .then((json) => {
        if (active) {
          setData(json as ApiResponse);
          setAgora(Date.now());
        }
      })
      .catch((e) => active && setErro(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const todas = useMemo(() => data?.ocorrencias ?? [], [data]);
  const osint = useMemo(() => data?.meta.osint ?? [], [data]);

  const fcFiltradas = useMemo(
    () =>
      filtro === "osint"
        ? []
        : [...todas].filter((o) => filtro === "todos" || o.contexto === filtro).sort((a, b) => (a.data < b.data ? 1 : -1)),
    [todas, filtro],
  );
  const osintVisiveis = useMemo(() => (filtro === "todos" || filtro === "osint" ? osint : []), [filtro, osint]);

  // Feed: FC + OSINT juntos, mais recente primeiro (fidelidades sinalizadas item a item).
  const feed = useMemo(() => {
    const itens: ({ kind: "fc"; o: ShootingOccurrence } | { kind: "osint"; p: OsintPoint })[] = [
      ...fcFiltradas.map((o) => ({ kind: "fc" as const, o })),
      ...osintVisiveis.map((p) => ({ kind: "osint" as const, p })),
    ];
    itens.sort((a, b) => {
      const da = a.kind === "fc" ? a.o.data : (a.p.data ?? "");
      const db = b.kind === "fc" ? b.o.data : (b.p.data ?? "");
      return da < db ? 1 : -1;
    });
    return itens.slice(0, 140);
  }, [fcFiltradas, osintVisiveis]);

  // "Perto de mim": geolocalização real → registro/indício mais próximo.
  // Resultado escrito na live region (role="status") — acessibilidade preservada.
  function pertoDeMim() {
    if (!("geolocation" in navigator)) {
      setGeoMsg("Geolocalização indisponível neste navegador.");
      return;
    }
    setGeoMsg("Localizando…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const me = { lat: p.coords.latitude, lng: p.coords.longitude };
        let best: { km: number; rotulo: string; kind: "fc" | "osint"; id: string } | null = null;
        for (const o of todas) {
          if (typeof o.lat !== "number" || typeof o.lng !== "number") continue;
          const km = haversineKm(me, { lat: o.lat, lng: o.lng });
          if (!best || km < best.km) best = { km, rotulo: `${o.municipio}/${o.estado}`, kind: "fc", id: o.id };
        }
        for (const q of osint) {
          const km = haversineKm(me, { lat: q.lat, lng: q.lng });
          if (!best || km < best.km) best = { km, rotulo: `${q.municipio}/${q.uf}`, kind: "osint", id: q.id };
        }
        setUserPos(me);
        if (!best) {
          setGeoMsg("Localização obtida, mas nenhum registro/indício geolocalizado na janela atual.");
          return;
        }
        const kmTx = best.km < 1 ? "<1" : String(Math.round(best.km));
        setGeoMsg(
          best.kind === "fc"
            ? `Registro mais próximo: ${best.rotulo} · ~${kmTx} km. Não é alerta de emergência.`
            : `Indício de notícia mais próximo: ${best.rotulo} · ~${kmTx} km (precisão municipal). Não é alerta de emergência.`,
        );
        setSelId(best.id);
      },
      (err) => setGeoMsg(err.code === err.PERMISSION_DENIED ? "Permissão de localização negada." : "Não foi possível obter sua localização."),
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  const kpi = {
    ocorr: data?.meta.total ?? todas.length,
    mortos: data?.meta.mortos ?? 0,
    policia: data?.meta.porContexto?.policia ?? 0,
    disputa: data?.meta.porContexto?.disputa ?? 0,
    outro: data?.meta.porContexto?.outro ?? 0,
    osint: osint.length,
    ufs: data?.meta.osintUfs ?? 0,
  };

  const filtros: { id: Filtro; label: string; n: number; cor?: string }[] = [
    { id: "todos", label: "TODOS", n: todas.length + osint.length },
    { id: "disputa", label: "DISPUTA", n: kpi.disputa, cor: CONTEXTO_COR.disputa },
    { id: "policia", label: "AÇÃO POLICIAL", n: kpi.policia, cor: CONTEXTO_COR.policia },
    { id: "outro", label: "OUTRO", n: kpi.outro, cor: CONTEXTO_COR.outro },
    { id: "osint", label: "◆ INDÍCIOS", n: kpi.osint, cor: INDICIO },
  ];

  const destaque = hoverId ?? selId;

  return (
    <main className="flex min-h-screen flex-col bg-bg0 text-ink">
      <AppHeader />

      <div className="grid grid-cols-1 border-b border-line lg:grid-cols-[minmax(0,1fr)_392px]">
        {/* ===== PAINEL DO MAPA ===== */}
        <div className="panel-grid relative min-h-[560px] overflow-hidden bg-maparea lg:h-[calc(100vh-224px)] lg:min-h-[660px]">
          {loading ? (
            <div className="flex h-full items-center justify-center font-mono text-[11px] tracking-[.18em] text-quat">
              CARREGANDO JANELA…
            </div>
          ) : (
            <ShootingsMap
              ocorrencias={fcFiltradas}
              osint={osintVisiveis}
              focus={userPos}
              highlightId={destaque}
              onHover={setHoverId}
            />
          )}

          {/* overlay editorial (não intercepta o mouse) */}
          <div className="pointer-events-none absolute left-[26px] top-[26px] z-[5] max-w-[460px]">
            <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[.28em] text-registro">
              <span className="inline-block h-px w-[22px] bg-registro" />
              RADAR DE TIROTEIOS — TEMPO QUASE REAL
            </div>
            <div className="mt-3.5 flex items-baseline gap-3.5">
              <div className="text-[72px] font-[640] leading-[.82] tracking-[-0.02em] text-ink [font-stretch:112%] sm:text-[104px]">
                {loading ? "—" : kpi.ocorr}
              </div>
              <div className="max-w-[210px] text-[15px] leading-[1.45] text-sec">
                ocorrências de disparo registradas nos últimos <span className="text-ink">{data?.meta.dias ?? 7} dias</span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="flex items-center gap-[7px] border border-edge bg-[rgba(12,13,16,.72)] px-[11px] py-[7px] font-mono text-[10px] tracking-[.1em] text-sec backdrop-blur-[4px]">
                <span className="text-[13px] font-semibold text-ink">{kpi.mortos}</span> MORTOS NA JANELA
              </span>
              <span className="flex items-center gap-[7px] border border-edge bg-[rgba(12,13,16,.72)] px-[11px] py-[7px] font-mono text-[10px] tracking-[.1em] text-sec backdrop-blur-[4px]">
                <span className="h-1.5 w-1.5 rounded-full bg-policia" />
                <span className="text-[13px] font-semibold text-ink">{kpi.policia}</span> AÇÃO POLICIAL
              </span>
              <span className="flex items-center gap-[7px] border border-edge bg-[rgba(12,13,16,.72)] px-[11px] py-[7px] font-mono text-[10px] tracking-[.1em] text-sec backdrop-blur-[4px]">
                <span className="h-1.5 w-1.5 rounded-full bg-registro" />
                <span className="text-[13px] font-semibold text-ink">{kpi.disputa}</span> DISPUTA
              </span>
              <span className="flex items-center gap-[7px] border border-[rgba(226,163,59,.35)] bg-[rgba(226,163,59,.06)] px-[11px] py-[7px] font-mono text-[10px] tracking-[.1em] text-indiciotx backdrop-blur-[4px]">
                <span className="h-1.5 w-1.5 rotate-45 border border-indicio" />
                <span className="text-[13px] font-semibold text-indicio">{kpi.osint}</span> INDÍCIOS EM {kpi.ufs} UFs
              </span>
            </div>
          </div>

          {/* chips de filtro (filtram mapa E feed) */}
          <div className="absolute bottom-6 left-[26px] z-[6] flex flex-col gap-2.5">
            <div className="font-mono text-[9px] tracking-[.24em] text-quat">FILTRAR CONTEXTO</div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar contexto">
              {filtros.map((f) => {
                const act = filtro === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltro(f.id)}
                    aria-pressed={act}
                    className="flex items-center gap-[7px] border px-[11px] py-[7px] font-mono text-[9.5px] tracking-[.14em] backdrop-blur-[4px] hover:border-edgehover hover:text-ink"
                    style={{
                      background: act ? "rgba(236,234,228,.1)" : "rgba(12,13,16,.72)",
                      borderColor: act ? (f.cor ?? "#ECEAE4") : "#262B33",
                      color: act ? "#ECEAE4" : "#797F88",
                    }}
                  >
                    {f.label}
                    <span className="font-semibold" style={{ color: act ? (f.cor ?? "#ECEAE4") : "#565B63" }}>
                      {f.n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* nota de cobertura */}
          <div className="pointer-events-none absolute bottom-6 right-[22px] z-[5] hidden text-right font-mono text-[9px] leading-[2] tracking-[.14em] text-quat md:block">
            <div className="text-[#6C717A]">COBERTURA AO VIVO — FOGO CRUZADO</div>
            <div>RM RIO · RM RECIFE · RM SALVADOR · RM BELÉM</div>
            <div className="text-indiciodim">FORA DELAS: ◆ INDÍCIO DE NOTÍCIA, NÃO REGISTRO</div>
          </div>
        </div>

        {/* ===== FEED ===== */}
        <aside className="flex min-h-[480px] flex-col border-l border-line bg-panel lg:h-[calc(100vh-224px)] lg:min-h-[660px]">
          <div className="border-b border-hair px-[18px] pb-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] tracking-[.24em] text-sec">FEED DE OCORRÊNCIAS</h2>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={pertoDeMim}
                  title="Localizar o registro ou indício mais próximo de você"
                  className="flex items-center gap-1.5 border border-edge px-2.5 py-1.5 font-mono text-[9px] tracking-[.14em] text-sec hover:border-policia hover:text-policiatx"
                >
                  ◎ PERTO DE MIM
                </button>
                <button
                  type="button"
                  onClick={carregar}
                  className="flex items-center gap-1.5 border border-edge px-2.5 py-1.5 font-mono text-[9px] tracking-[.14em] text-sec hover:border-edgehover hover:text-ink"
                >
                  {loading ? "◌ ATUALIZANDO" : "↻ ATUALIZAR"}
                </button>
              </div>
            </div>
            <p className="mt-2 font-mono text-[9.5px] tracking-[.06em] text-quat">
              {loading
                ? "carregando janela…"
                : `${feed.length} itens na janela · ${todas.length} registros FC + ${osint.length} indícios OSINT · fonte: ${data?.meta.fonte ?? "Fogo Cruzado"} + Google Notícias`}
              {data?.meta.aviso ? ` · ${data.meta.aviso}` : ""}
            </p>
            {/* live region persistente: status da geolocalização anunciado a leitores de tela */}
            <div role="status" aria-live="polite">
              {geoMsg ? (
                <p className="mt-2 border border-[rgba(79,160,232,.3)] bg-[rgba(79,160,232,.07)] px-2.5 py-2 font-mono text-[10px] leading-[1.6] text-policiatx">
                  {geoMsg}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-hair bg-[rgba(229,72,77,.04)] px-[18px] py-2">
            <span className="h-[5px] w-[5px] flex-none rounded-full bg-registro" />
            <span className="font-mono text-[9px] tracking-[.12em] text-[#8E9299]">
              NÃO É ALERTA DE EMERGÊNCIA — EM URGÊNCIAS, LIGUE <span className="text-registro">190</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {erro ? (
              <p className="border-b border-hair px-[18px] py-3 font-mono text-[10px] leading-[1.6] text-registro">
                FALHA AO CARREGAR: {erro}
              </p>
            ) : null}
            {!loading && feed.length === 0 && !erro ? (
              <p className="px-[18px] py-4 font-mono text-[10px] tracking-[.1em] text-quat">NENHUM ITEM NO FILTRO ATUAL.</p>
            ) : null}
            {feed.map((it) => {
              const id = it.kind === "fc" ? it.o.id : it.p.id;
              const hot = destaque === id;
              const cor = it.kind === "fc" ? CONTEXTO_COR[it.o.contexto] : INDICIO;
              return (
                <button
                  key={id}
                  type="button"
                  onMouseEnter={() => setHoverId(id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(id)}
                  onBlur={() => setHoverId(null)}
                  onClick={() => setSelId(selId === id ? null : id)}
                  className="block w-full border-b border-[#14161A] px-[18px] py-3 text-left hover:bg-hoverrow"
                  style={{ background: hot ? "#13161B" : undefined, boxShadow: hot ? `inset 2px 0 0 ${cor}` : undefined }}
                >
                  <span className="flex items-center gap-2">
                    {it.kind === "fc" ? (
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: cor }} />
                    ) : (
                      <span className="h-[7px] w-[7px] flex-none rotate-45 border border-indicio" />
                    )}
                    <span className="font-mono text-[9.5px] tracking-[.16em]" style={{ color: cor }}>
                      {it.kind === "fc" ? CONTEXTO_LABEL[it.o.contexto].toUpperCase() : "INDÍCIO DE NOTÍCIA"}
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] text-quat">
                      {tempoLabel(it.kind === "fc" ? it.o.data : it.p.data, agora)}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[13.5px] font-[560] leading-[1.35] text-[#E4E2DC]">
                    {it.kind === "fc"
                      ? `${it.o.bairro ? it.o.bairro + " — " : ""}${it.o.municipio}/${it.o.estado}`
                      : `${it.p.municipio} / ${it.p.uf}`}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] leading-[1.55] text-ter">
                    {it.kind === "fc"
                      ? `${it.o.mortos} morto(s) · ${it.o.feridos} ferido(s)${it.o.mainReason ? ` · ${it.o.mainReason}` : ""}`
                      : `“${it.p.titulo.slice(0, 90)}”${it.p.veiculo ? ` — ${it.p.veiculo}` : ""} · precisão municipal`}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ===== TENDÊNCIA NACIONAL (SINESP/VDE) ===== */}
      <TrendNacional serie={nacional} />

      {/* ===== POR MUNICÍPIO (tabela compacta, colapsada) ===== */}
      {data?.meta.porMunicipio?.length ? <PorMunicipio linhas={data.meta.porMunicipio} /> : null}
    </main>
  );
}

// Faixa full-width com a série mensal nacional completa (2015 → hoje).
function TrendNacional({ serie }: { serie: SerieNacional }) {
  const { labels, vals } = serie;
  if (!vals.length) return null;
  const last = vals[vals.length - 1];
  const lastLabel = labels[labels.length - 1]; // "2026-04"
  const [anoTx, mesTx] = lastLabel.split("-");
  const mesNome = MESES_CURTO[Number(mesTx) - 1] ?? mesTx;
  const prevYr = vals.length >= 13 ? vals[vals.length - 13] : null;
  const dMes = prevYr ? ((last - prevYr) / prevYr) * 100 : null;
  const sum12 = vals.slice(-12).reduce((a, b) => a + b, 0);
  const prev12 = vals.slice(-24, -12).reduce((a, b) => a + b, 0);
  const d12 = prev12 ? ((sum12 - prev12) / prev12) * 100 : null;
  // é o menor valor deste mês em toda a série?
  const mesmoMes = labels.map((l, i) => ({ l, v: vals[i] })).filter(({ l }) => l.endsWith(`-${mesTx}`));
  const menorDoMes = mesmoMes.every(({ v }) => last <= v);

  const W = 1200;
  const H = 170;
  const pad = 8;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i: number) => pad + (i / (vals.length - 1)) * (W - 2 * pad);
  const y = (v: number) => 14 + (1 - (v - min) / (max - min)) * (H - 44);
  let line = "";
  vals.forEach((v, i) => {
    line += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1);
  });
  const area = line + `L${x(vals.length - 1).toFixed(1)} ${H - 6}L${x(0).toFixed(1)} ${H - 6}Z`;
  const iPeak = vals.indexOf(max);
  const peakLabel = labels[iPeak];
  const [pAno, pMes] = peakLabel.split("-");
  const peakPctX = ((x(iPeak) / W) * 100).toFixed(1);

  const fmtDelta = (d: number | null) =>
    d == null ? "—" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1).replace(".", ",")}%`;

  return (
    <section className="grid grid-cols-1 border-b border-line bg-maparea md:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col justify-center gap-2 border-r border-hair px-[26px] py-[22px]">
        <h2 className="font-mono text-[9.5px] tracking-[.24em] text-quat">
          TENDÊNCIA NACIONAL — HOMICÍDIO DOLOSO <span className="text-ghost">· SINESP/VDE</span>
        </h2>
        <div className="flex items-baseline gap-2.5">
          <span className="text-[44px] font-[640] leading-none tracking-[-0.02em] text-ink [font-stretch:112%]">{fmtInt(last)}</span>
          <span className={`font-mono text-[10.5px] tracking-[.06em] ${dMes != null && dMes <= 0 ? "text-positivo" : "text-registro"}`}>
            {fmtDelta(dMes)} a/a
          </span>
        </div>
        <p className="text-[12.5px] leading-[1.55] text-ter">
          registros em <span className="text-sec">{mesNome}/{anoTx}</span>
          {menorDoMes ? ` — o menor ${mesNome} de toda a série desde 2015` : ""}. Últimos 12 meses:{" "}
          <span className="text-ink">{fmtInt(sum12)}</span> mortes ({fmtDelta(d12)}).
        </p>
      </div>
      <div className="relative min-h-[170px] pt-2.5">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" className="absolute inset-0 block" aria-hidden="true">
          <defs>
            <linearGradient id="natg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(229,72,77,.22)" />
              <stop offset="100%" stopColor="rgba(229,72,77,0)" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#natg)" />
          <path d={line} fill="none" stroke="#E5484D" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={H - 6} x2={W} y2={H - 6} stroke="#1E2126" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {vals.map((_, i) => (i % 12 === 0 ? <line key={i} x1={x(i)} y1={H - 6} x2={x(i)} y2={H - 1} stroke="#33383F" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null))}
          <circle cx={x(iPeak)} cy={y(max)} r="2.6" fill="#ECEAE4" />
          <circle cx={x(vals.length - 1)} cy={y(last)} r="2.6" fill="#E5484D" stroke="#ECEAE4" strokeWidth="0.8" />
        </svg>
        <div className="pointer-events-none absolute top-3 -translate-x-1/2 text-center" style={{ left: `${peakPctX}%` }}>
          <span className="font-mono text-[9px] tracking-[.12em] text-sec">
            PICO {MESES_CURTO[Number(pMes) - 1]?.toUpperCase()}/{pAno} — {fmtInt(max)}
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-[46px] right-3.5 text-right">
          <span className="font-mono text-[9px] tracking-[.12em] text-registro">
            {mesNome.toUpperCase()}/{anoTx} — {fmtInt(last)}
          </span>
        </div>
      </div>
    </section>
  );
}

// Tabela por município (tiroteios × cobertura de imprensa), colapsada — o herói
// da home é o mapa; o detalhe municipal abre sob demanda.
function PorMunicipio({ linhas }: { linhas: MunicipioResumoFull[] }) {
  return (
    <details className="border-b border-line">
      <summary className="cursor-pointer px-7 py-3.5 font-mono text-[10px] tracking-[.22em] text-quat hover:bg-cellhead hover:text-sec">
        POR MUNICÍPIO — TIROTEIOS NA JANELA × IMPRENSA (OSINT) ▾
      </summary>
      <div className="overflow-x-auto px-7 pb-6">
        <table className="w-full border-collapse border border-line text-sm">
          <thead>
            <tr className="bg-cellhead text-left font-mono text-[8.5px] uppercase tracking-[.18em] text-quat">
              <th className="px-3.5 py-2.5 font-normal">Município</th>
              <th className="px-3.5 py-2.5 font-normal">Tiroteios</th>
              <th className="px-3.5 py-2.5 font-normal" title="% dos tiroteios por disputa entre grupos">
                % disputa
              </th>
              <th className="px-3.5 py-2.5 font-normal">Mortos</th>
              <th className="px-3.5 py-2.5 font-normal" title="Notícias OSINT no município (indício, não fato)">
                Imprensa
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 25).map((m) => (
              <tr key={`${m.municipio}|${m.estado}`} className="border-t border-hair bg-panel">
                <td className="px-3.5 py-2.5 text-[13px] font-medium text-ink">
                  {m.municipio}
                  <span className="text-quat"> / {m.estado}</span>
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[12px] text-sec">{m.total}</td>
                <td className="px-3.5 py-2.5 font-mono text-[12px] text-sec">{(m.disputaShare * 100).toFixed(0)}%</td>
                <td className="px-3.5 py-2.5 font-mono text-[12px] text-ter">{m.mortos}</td>
                <td className="px-3.5 py-2.5">
                  {m.noticias.length ? (
                    <details className="group">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-[10px] tracking-[.08em] text-indiciotx hover:text-indicio">
                        ◆ {m.noticias.length} <span className="text-quat group-open:hidden">▸</span>
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {m.noticias.map((n, i) => (
                          <li key={`${n.url}|${i}`} className="text-[11px] leading-tight">
                            {n.url ? (
                              <a className="text-sec underline underline-offset-2 hover:text-ink" href={n.url} target="_blank" rel="noopener noreferrer">
                                {n.titulo}
                              </a>
                            ) : (
                              <span className="text-sec">{n.titulo}</span>
                            )}
                            <span className="text-quat">
                              {n.veiculo ? ` · ${n.veiculo}` : ""}
                              {n.data ? ` · ${n.data}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <span className="font-mono text-[11px] text-ghost">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 font-mono text-[9.5px] leading-[1.8] tracking-[.06em] text-quat">
          “IMPRENSA” LIGA AO ACERVO DE{" "}
          <Link className="underline underline-offset-2 hover:text-sec" href="/noticias">
            NOTÍCIAS OSINT
          </Link>{" "}
          DO MUNICÍPIO · A LEITURA DE GOVERNANÇA POR UF ESTÁ NO{" "}
          <Link className="underline underline-offset-2 hover:text-sec" href="/radar">
            RADAR DE ANOMALIA
          </Link>{" "}
          · INDÍCIO, NÃO ACUSAÇÃO.
        </p>
      </div>
    </details>
  );
}
