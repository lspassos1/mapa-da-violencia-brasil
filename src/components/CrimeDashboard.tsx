"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Map as MapIcon, Table as TableIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { DataModeBanner } from "@/components/layout/DataModeBanner";
import { CrimeFilters } from "@/components/filters/CrimeFilters";
import { BrazilCrimeMap } from "@/components/map/BrazilCrimeMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { AccessibleDataTable } from "@/components/panels/AccessibleDataTable";
import { MunicipalityDetailsPanel } from "@/components/panels/MunicipalityDetailsPanel";
import { RankingPanel } from "@/components/panels/RankingPanel";
import { getRankedMunicipalities } from "@/lib/ranking";
import {
  getAvailableIndicators,
  getAvailablePeriods,
  getCrimeMetadata,
  getCrimeMapData,
  getDefaultCrimeMapFilters,
  getDemoDataStatus,
} from "@/services/crimeDataService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

const defaultFilters = getDefaultCrimeMapFilters();
const indicators = getAvailableIndicators();
const periods = getAvailablePeriods();
const demoStatus = getDemoDataStatus();
const metadata = getCrimeMetadata();
const dataScope = metadata.scope;
const viewModes = metadata.viewModes;
const TABLE_ROW_LIMIT = 200;
const officialDataLabel =
  demoStatus.mode === "official_sample"
    ? "Amostra oficial: homicidio doloso (vitimas)"
    : demoStatus.mode === "official"
      ? "Dados oficiais agregados"
      : "Dados demonstrativos nesta versao";

export function CrimeDashboard() {
  const [indicator, setIndicator] = useState<CrimeIndicatorKey>(defaultFilters.indicator);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultFilters.viewMode);
  const [period, setPeriod] = useState(defaultFilters.period);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<MunicipalityCrimeData | null>(null);
  const [showTable, setShowTable] = useState(false);

  const mapResult = useMemo(
    () => getCrimeMapData({ indicator, period, viewMode, uf: null }),
    [indicator, period, viewMode],
  );
  const rankingResult = useMemo(
    () => getCrimeMapData({ indicator, period, viewMode, uf: selectedState }),
    [indicator, period, selectedState, viewMode],
  );
  const currentData = mapResult.items;
  const visibleMapData = selectedState ? rankingResult.items : currentData;
  const ranking = rankingResult.ranking;

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
    <main className="flex min-h-screen flex-col overflow-hidden text-slate-100">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyan-300 focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-950"
      >
        Saltar para o conteudo principal
      </a>
      <AppHeader />
      <DataModeBanner
        mode={metadata.dataMode}
        municipalities={dataScope.municipalities}
        periodLabel={selectedPeriodLabel}
      />
      <section
        id="conteudo-principal"
        className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)_340px] lg:p-5"
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
          <RankingPanel
            data={ranking}
            indicator={indicator}
            selectedMunicipalityId={selectedMunicipality?.idIbge ?? null}
            viewMode={viewMode}
            onSelect={handleMunicipalitySelect}
          />
        </aside>

        <section className="relative min-h-[620px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/80 shadow-2xl">
          <div className="absolute left-4 right-4 top-4 z-10 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <Breadcrumb
              selectedMunicipality={selectedMunicipality}
              selectedState={selectedState}
              onBackToBrazil={handleBackToBrazil}
              onBackToState={handleBackToState}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex overflow-hidden rounded-lg border border-white/10 bg-slate-950/80 text-xs font-medium backdrop-blur"
                role="group"
                aria-label="Alternar visualizacao"
              >
                <button
                  type="button"
                  aria-pressed={!showTable}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 ${
                    !showTable ? "bg-cyan-300/20 text-cyan-100" : "text-slate-300 hover:text-cyan-200"
                  }`}
                  onClick={() => setShowTable(false)}
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" />
                  Mapa
                </button>
                <button
                  type="button"
                  aria-pressed={showTable}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 ${
                    showTable ? "bg-cyan-300/20 text-cyan-100" : "text-slate-300 hover:text-cyan-200"
                  }`}
                  onClick={() => setShowTable(true)}
                >
                  <TableIcon className="h-4 w-4" aria-hidden="true" />
                  Tabela
                </button>
              </div>
              {metadata.dataMode === "official" ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 backdrop-blur">
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
              />
              <div className="absolute bottom-4 left-4 z-10">
                <MapLegend />
              </div>
            </>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Status da base</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Fonte:</span> {demoStatus.source}
              </p>
              <p>
                <span className="text-slate-500">Modo:</span>{" "}
                {demoStatus.mode === "official_sample" ? "amostra oficial" : demoStatus.mode ?? "demo"}
              </p>
              <p>
                <span className="text-slate-500">Periodo:</span> {selectedPeriodLabel}
              </p>
              <p>
                <span className="text-slate-500">Atualizado:</span> {demoStatus.lastUpdated}
              </p>
              <p>
                <span className="text-slate-500">Escopo:</span> {dataScope.municipalities} municipios,
                {" "}{dataScope.ufs} UF
              </p>
              <p>
                <span className="text-slate-500">Cobertura:</span> {dataScope.indicators} indicador,
                {" "}{dataScope.periods} periodos
              </p>
              <p>
                <span className="text-slate-500">Serie:</span>{" "}
                {dataScope.hasVariationSeries ? "variacao disponivel" : "sem serie para variacao"}
              </p>
            </div>
          </div>
          <MunicipalityDetailsPanel
            allData={currentData}
            indicator={indicator}
            municipality={selectedMunicipality}
            selectedState={selectedState}
            viewMode={viewMode}
          />
        </aside>
      </section>
    </main>
  );
}
