"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Map as MapIcon, Table as TableIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { DataModeBanner } from "@/components/layout/DataModeBanner";
import { CrimeFilters } from "@/components/filters/CrimeFilters";
import { BrazilCrimeMap } from "@/components/map/BrazilCrimeMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { AccessibleDataTable } from "@/components/panels/AccessibleDataTable";
import { MunicipalityDetailsPanel } from "@/components/panels/MunicipalityDetailsPanel";
import { StateProfilePanel } from "@/components/panels/StateProfilePanel";
import { UfDetailsPanel } from "@/components/panels/UfDetailsPanel";
import { RankingPanel } from "@/components/panels/RankingPanel";
import { getRankedMunicipalities } from "@/lib/ranking";
import { isRemoteDataMode } from "@/lib/dataMode";
import { riskLevelLabels } from "@/lib/riskLevel";
import { ufDatumToMunicipality } from "@/lib/ufDisplay";
import { getStaticCrimeDataApi, loadCrimeDataApi, type CrimeDataApi } from "@/services/crimeDataService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, UfDatum, ViewMode } from "@/types/crime";

const TABLE_ROW_LIMIT = 200;
// Sentinela estavel para o caminho nao-UF: evita um array novo a cada render que
// invalidaria o useMemo de BrazilCrimeMap (re-disparo de setPaintProperty).
const EMPTY_UF: UfDatum[] = [];

function riskLabelForCsv(nivel: keyof typeof riskLevelLabels): string {
  return riskLevelLabels[nivel] ?? String(nivel);
}

// Em demo/official_sample a carga e sincrona (loadCrimeDataApi resolve de
// imediato), por isso a API ja esta disponivel no primeiro render — preservando
// o SSR. No modo `official` a carga nacional vem por fetch do asset estatico em
// public/officialCrimeData.json; ate resolver, mostramos um estado de carga.
export function CrimeDashboard() {
  // Em demo/official_sample a API estatica ja traz os dados reais no primeiro
  // render (preserva o SSR). Em official iniciamos vazio e mostramos o estado de
  // carga ate o fetch do asset nacional resolver.
  const [api, setApi] = useState<CrimeDataApi | null>(
    isRemoteDataMode() ? null : getStaticCrimeDataApi(),
  );

  useEffect(() => {
    let active = true;
    loadCrimeDataApi().then((loaded) => {
      if (active) {
        setApi(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!api) {
    return (
      <main className="flex min-h-screen flex-col bg-bg0 text-ink">
        <AppHeader />
        <div
          className="flex flex-1 items-center justify-center p-8 font-mono text-[11px] tracking-[.18em] text-quat"
          role="status"
          aria-live="polite"
        >
          CARREGANDO A CARGA NACIONAL…
        </div>
      </main>
    );
  }

  return <CrimeDashboardView api={api} />;
}

function CrimeDashboardView({ api }: { api: CrimeDataApi }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultFilters = api.getDefaultCrimeMapFilters();
  const indicators = api.getAvailableIndicators();
  const periods = api.getAvailablePeriods();
  const demoStatus = api.getDemoDataStatus();
  const metadata = api.getCrimeMetadata();
  const dataScope = metadata.scope;
  const viewModes = metadata.viewModes;
  const officialDataLabel =
    demoStatus.mode === "official_sample"
      ? "Amostra oficial: homicidio doloso (vitimas)"
      : demoStatus.mode === "official"
        ? "Dados oficiais agregados"
        : "Dados demonstrativos nesta versao";

  // Estado inicial a partir da URL (deep-link partilhavel); cada parametro e
  // validado contra o catalogo — valores desconhecidos caem nos padroes.
  const rawIndicator = searchParams.get("indicador") ?? "";
  const rawMode = searchParams.get("modo") ?? "";
  const rawPeriod = searchParams.get("periodo") ?? "";
  const rawUf = (searchParams.get("uf") ?? "").toUpperCase();
  const rawMunicipio = searchParams.get("municipio") ?? "";
  const initialIndicator = api.isCrimeIndicatorKey(rawIndicator) ? rawIndicator : defaultFilters.indicator;
  const initialMode = api.isViewMode(rawMode) ? rawMode : defaultFilters.viewMode;
  const initialPeriod = periods.some((option) => option.key === rawPeriod) ? rawPeriod : defaultFilters.period;
  const initialUf = metadata.ufs.some((entry) => entry.uf === rawUf) ? rawUf : null;
  const initialMunicipality = initialUf && rawMunicipio ? api.getMunicipalityById(rawMunicipio, initialPeriod) : null;

  const [indicator, setIndicator] = useState<CrimeIndicatorKey>(initialIndicator);
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [period, setPeriod] = useState(initialPeriod);
  const [selectedState, setSelectedState] = useState<string | null>(initialUf);
  const [selectedMunicipality, setSelectedMunicipality] = useState<MunicipalityCrimeData | null>(
    initialMunicipality,
  );
  const [showTable, setShowTable] = useState(searchParams.get("vista") === "tabela");

  // Reflete os filtros na URL para qualquer vista ser partilhavel/restauravel.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("indicador", indicator);
    params.set("modo", viewMode);
    params.set("periodo", period);
    if (selectedState) {
      params.set("uf", selectedState);
    }
    if (selectedMunicipality) {
      params.set("municipio", selectedMunicipality.idIbge);
    }
    if (showTable) {
      params.set("vista", "tabela");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [indicator, viewMode, period, selectedState, selectedMunicipality, showTable, pathname, router]);

  const mapResult = useMemo(
    () => api.getCrimeMapData({ indicator, period, viewMode, uf: null }),
    [api, indicator, period, viewMode],
  );
  const rankingResult = useMemo(
    () => api.getCrimeMapData({ indicator, period, viewMode, uf: selectedState }),
    [api, indicator, period, selectedState, viewMode],
  );
  const currentData = mapResult.items;
  const visibleMapData = selectedState ? rankingResult.items : currentData;

  // Indicadores so-UF (patrimoniais/sexuais): o degrade dos estados vem de
  // ufData e o ranking lista estados (nao municipios).
  const isUf = api.isUfIndicator(indicator);
  // Consts simples: com o React Compiler ativo, a memoizacao e automatica
  // (evita o conflito de "preserve-manual-memoization" com deps de membro).
  // O degrade dos estados tambem vem do ufData no modo "variacao anual" (a
  // variacao por UF nao e somavel a partir dos municipios).
  const needsUfChoropleth = isUf || viewMode === "variacaoAnual";
  const ufChoropleth = needsUfChoropleth ? api.getUfChoropleth(period, indicator) : EMPTY_UF;
  const nameByUf = new Map(metadata.ufs.map((entry) => [entry.uf, entry.nome]));
  const ufRankingItems = ufChoropleth.map((datum) =>
    ufDatumToMunicipality(datum, nameByUf.get(datum.uf) ?? datum.uf),
  );
  const selectedUfDatum = isUf && selectedState ? api.getUfDatum(selectedState, period, indicator) : null;

  // Perfil do estado (indicador municipal, estado aberto sem municipio):
  // serie historica da UF, posicao no ranking nacional e media da taxa.
  const showStateProfile = !isUf && selectedState !== null && selectedMunicipality === null;
  const indicatorUfData = showStateProfile ? api.getUfIndicatorData(indicator) : EMPTY_UF;
  const stateSeries = indicatorUfData
    .filter((datum) => datum.uf === selectedState)
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const periodUfData = indicatorUfData.filter((datum) => datum.periodo === period);
  const stateProfileCurrent = showStateProfile
    ? periodUfData.find((datum) => datum.uf === selectedState) ?? null
    : null;
  const stateNationalRank =
    [...periodUfData].sort((a, b) => b.total - a.total).findIndex((datum) => datum.uf === selectedState) + 1;
  const periodTaxas = periodUfData
    .map((datum) => datum.taxa100k)
    .filter((taxa): taxa is number => typeof taxa === "number");
  const nationalAvgTaxa =
    periodTaxas.length > 0 ? periodTaxas.reduce((sum, taxa) => sum + taxa, 0) / periodTaxas.length : null;
  // Dois rankings em qualquer nivel (nacional = pais inteiro; estado = municipios
  // da UF; indicador so-UF = estados): os 10 piores e os 10 melhores indices.
  const rankingBase = isUf ? ufRankingItems : rankingResult.items;
  const rankingWorst = getRankedMunicipalities(rankingBase, indicator, viewMode, null, 10, "desc");
  const rankingBest = getRankedMunicipalities(rankingBase, indicator, viewMode, null, 10, "asc");

  const selectedPeriod = periods.find((option) => option.key === period) ?? periods[0];
  // Modo 'official' sem carga gerada nao tem periodos: evita aceder a undefined.
  const selectedPeriodLabel = selectedPeriod?.label ?? "Indisponivel";
  const indicatorLabel = indicators.find((option) => option.key === indicator)?.label ?? "Indicador";
  const viewModeLabel = viewModes.find((option) => option.key === viewMode)?.label ?? "Valor";
  // Limita as linhas renderizadas para nao montar milhares de nos DOM de uma
  // vez na vista nacional (com dados reais, ~5.570 municipios). A nota de
  // truncamento avisa quando o limite e atingido; refinar o estado por UF
  // reduz o conjunto.
  const rankedAll = useMemo(
    () => getRankedMunicipalities(visibleMapData, indicator, viewMode, null, visibleMapData.length),
    [visibleMapData, indicator, viewMode],
  );
  const tableData = rankedAll.slice(0, TABLE_ROW_LIMIT);

  // Exporta TODAS as linhas filtradas (nao so as 200 renderizadas) em CSV com
  // BOM UTF-8 e separador ';' (formato esperado pelo Excel pt-BR).
  function handleExportCsv() {
    const decimal = (value: number | null | undefined) =>
      typeof value === "number" ? String(value).replace(".", ",") : "";
    const header = ["posicao", "municipio", "uf", "id_ibge", "periodo", "indicador", "nivel", "total", "taxa_100k", "indice", "variacao_anual_pct"];
    const lines = rankedAll.map((item, index) => {
      const metric = item.indicadores[indicator];
      return [
        index + 1,
        `"${item.municipio.replaceAll('"', '""')}"`,
        item.uf,
        item.idIbge,
        item.periodo,
        `"${indicatorLabel.replaceAll('"', '""')}"`,
        metric ? riskLabelForCsv(metric.nivel) : "",
        metric?.total ?? "",
        decimal(metric?.taxa100k),
        metric?.score ?? "",
        decimal(metric?.variacaoAnual),
      ].join(";");
    });
    const csv = "\ufeff" + [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mapa-violencia_${indicator}_${period}${selectedState ? `_${selectedState}` : ""}.csv`;
    // O Safari exige o anchor no DOM para aceitar o click sintetico de download.
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleStateSelect(uf: string) {
    setSelectedState(uf);
    setSelectedMunicipality(null);
  }

  function handleMunicipalitySelect(item: MunicipalityCrimeData) {
    setSelectedState(item.uf);
    setSelectedMunicipality(item);
  }

  function handleBackToBrazil() {
    setSelectedState(null);
    setSelectedMunicipality(null);
  }

  function handleBackToState() {
    setSelectedMunicipality(null);
  }

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-bg0 text-ink">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:font-semibold focus:text-bg0"
      >
        Saltar para o conteudo principal
      </a>
      <AppHeader />
      <DataModeBanner
        mode={metadata.dataMode}
        municipalities={dataScope.municipalities}
        periodLabel={selectedPeriodLabel}
      />
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line px-7 pb-[22px] pt-[30px]">
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[.28em] text-sec">
            <span className="inline-block h-px w-[22px] bg-quat" />
            MAPA OFICIAL — ESTATÍSTICA CONSOLIDADA
          </div>
          <h1 className="mt-3 text-[32px] font-[620] leading-[1.02] tracking-[-0.015em] text-ink [font-stretch:115%] sm:text-[40px]">
            O país, medido pelo dado oficial
          </h1>
          <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-[1.6] text-ter">
            {indicatorLabel} por município e UF. Clique em um estado para abrir o perfil e ver os municípios com
            fronteiras reais.
          </p>
        </div>
        <div className="flex-none text-right font-mono text-[9.5px] leading-[2.1] tracking-[.14em] text-quat">
          <div>
            FONTE — <span className="text-sec">{demoStatus.source.toUpperCase()}</span>
          </div>
          <div>
            JANELA — <span className="text-sec">{selectedPeriodLabel.toUpperCase()}</span>
          </div>
          <div>
            MODO — <span className="text-sec">{viewModeLabel.toUpperCase()}</span>
          </div>
        </div>
      </div>
      <section
        id="conteudo-principal"
        className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[440px_minmax(0,1fr)_340px] lg:p-5"
      >
        <aside className="flex min-h-0 flex-col gap-4">
          <CrimeFilters
            indicator={indicator}
            indicators={indicators}
            period={period}
            periods={periods}
            viewMode={viewMode}
            viewModes={viewModes}
            onIndicatorChange={(next) => {
              setIndicator(next);
              setSelectedMunicipality(null);
            }}
            onPeriodChange={(next) => {
              setPeriod(next);
              setSelectedMunicipality(null);
            }}
            onViewModeChange={(next) => {
              setViewMode(next);
              setSelectedMunicipality(null);
            }}
          />
          {/* Piores e melhores lado a lado, cada um com scroll interno, para a
              coluna nao crescer e esconder o segundo ranking. */}
          <div className="grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <RankingPanel
              data={rankingWorst}
              indicator={indicator}
              selectedMunicipalityId={isUf ? selectedState : selectedMunicipality?.idIbge ?? null}
              tone="worst"
              onSelect={isUf ? (item) => handleStateSelect(item.uf) : handleMunicipalitySelect}
            />
            <RankingPanel
              data={rankingBest}
              indicator={indicator}
              selectedMunicipalityId={isUf ? selectedState : selectedMunicipality?.idIbge ?? null}
              tone="best"
              onSelect={isUf ? (item) => handleStateSelect(item.uf) : handleMunicipalitySelect}
            />
          </div>
        </aside>

        <section className="panel-grid relative min-h-[620px] overflow-hidden border border-line bg-maparea">
          <div className="absolute left-4 right-4 top-4 z-10 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <Breadcrumb
              selectedMunicipality={selectedMunicipality}
              selectedState={selectedState}
              onBackToBrazil={handleBackToBrazil}
              onBackToState={handleBackToState}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex overflow-hidden border border-edge bg-[rgba(12,13,16,.85)] font-mono text-[10px] tracking-[.12em] backdrop-blur"
                role="group"
                aria-label="Alternar visualizacao"
              >
                <button
                  type="button"
                  aria-pressed={!showTable}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 ${
                    !showTable ? "bg-[rgba(236,234,228,.1)] text-ink" : "text-sec hover:text-ink"
                  }`}
                  onClick={() => setShowTable(false)}
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" />
                  MAPA
                </button>
                <button
                  type="button"
                  aria-pressed={showTable}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 ${
                    showTable ? "bg-[rgba(236,234,228,.1)] text-ink" : "text-sec hover:text-ink"
                  }`}
                  onClick={() => setShowTable(true)}
                >
                  <TableIcon className="h-4 w-4" aria-hidden="true" />
                  TABELA
                </button>
              </div>
              {metadata.dataMode === "official" ? (
                <div className="flex flex-wrap items-center gap-2 border border-edge bg-[rgba(12,13,16,.85)] px-3 py-2 font-mono text-[9.5px] tracking-[.1em] text-sec backdrop-blur">
                  <AlertTriangle className="h-4 w-4" />
                  {officialDataLabel}
                </div>
              ) : null}
            </div>
          </div>

          {showTable ? (
            <AccessibleDataTable
              data={tableData}
              total={rankedAll.length}
              onExport={handleExportCsv}
              indicator={indicator}
              indicatorLabel={indicatorLabel}
              viewMode={viewMode}
              viewModeLabel={viewModeLabel}
              periodLabel={selectedPeriodLabel}
              selectedMunicipalityId={selectedMunicipality?.idIbge ?? null}
              onSelect={handleMunicipalitySelect}
            />
          ) : (
            <>
              <BrazilCrimeMap
                data={visibleMapData}
                indicator={indicator}
                selectedMunicipality={selectedMunicipality}
                selectedState={selectedState}
                viewMode={viewMode}
                onMunicipalitySelect={handleMunicipalitySelect}
                onStateSelect={handleStateSelect}
                isUfIndicator={isUf}
                ufChoropleth={ufChoropleth}
              />
              <div className="absolute bottom-4 left-4 z-10">
                <MapLegend viewMode={viewMode} />
              </div>
            </>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="border border-line bg-panel p-4">
            <p className="font-mono text-[9.5px] uppercase tracking-[.22em] text-quat">STATUS DA BASE</p>
            <div className="mt-3 space-y-2 text-[13px] text-sec">
              <p>
                <span className="text-quat">Fonte:</span> {demoStatus.source}
              </p>
              <p>
                <span className="text-quat">Modo:</span>{" "}
                {demoStatus.mode === "official_sample" ? "amostra oficial" : demoStatus.mode ?? "demo"}
              </p>
              <p>
                <span className="text-quat">Periodo:</span> {selectedPeriodLabel}
              </p>
              <p>
                <span className="text-quat">Atualizado:</span> {demoStatus.lastUpdated}
              </p>
              <p>
                <span className="text-quat">Escopo:</span> {dataScope.municipalities} municipios,
                {" "}{dataScope.ufs} UF
              </p>
              <p>
                <span className="text-quat">Cobertura:</span> {dataScope.indicators} indicador,
                {" "}{dataScope.periods} periodos
              </p>
              <p>
                <span className="text-quat">Serie:</span>{" "}
                {dataScope.hasVariationSeries ? "variacao disponivel" : "sem serie para variacao"}
              </p>
            </div>
          </div>
          {isUf ? (
            <UfDetailsPanel
              indicators={indicators}
              indicatorKey={indicator}
              ufNome={selectedState ? nameByUf.get(selectedState) ?? selectedState : null}
              selectedState={selectedState}
              datum={selectedUfDatum}
            />
          ) : selectedState && !selectedMunicipality ? (
            <StateProfilePanel
              uf={selectedState}
              ufNome={nameByUf.get(selectedState) ?? selectedState}
              indicatorLabel={indicatorLabel}
              periodLabel={selectedPeriodLabel}
              current={stateProfileCurrent}
              series={stateSeries}
              nationalRank={stateNationalRank}
              nationalRankTotal={periodUfData.length}
              nationalAvgTaxa={nationalAvgTaxa}
              // Ordenado por TOTAL (e o valor exibido na lista), independente do
              // modo de visualizacao ativo — evita rotulos #1..#3 contraditorios.
              topMunicipalities={getRankedMunicipalities(rankingResult.items, indicator, "total", null, 3, "desc")}
              indicator={indicator}
              onSelectMunicipality={handleMunicipalitySelect}
            />
          ) : (
            <MunicipalityDetailsPanel
              allData={currentData}
              indicator={indicator}
              indicators={indicators}
              dataStatus={demoStatus}
              municipality={selectedMunicipality}
              selectedState={selectedState}
              viewMode={viewMode}
            />
          )}
        </aside>
      </section>
    </main>
  );
}
