"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrimeFilters } from "@/components/filters/CrimeFilters";
import { BrazilCrimeMap } from "@/components/map/BrazilCrimeMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { MunicipalityDetailsPanel } from "@/components/panels/MunicipalityDetailsPanel";
import { NewsIncidentsPanel } from "@/components/panels/NewsIncidentsPanel";
import { RankingPanel } from "@/components/panels/RankingPanel";
import {
  getAvailableIndicators,
  getAvailablePeriods,
  getCrimeMapData,
  getDefaultCrimeMapFilters,
  getDemoDataStatus,
} from "@/services/crimeDataService";
import {
  getAvailableNewsIncidentTypes,
  getDefaultNewsIncidentFilters,
  getNewsDataStatus,
  getNewsIncidentData,
} from "@/services/newsIncidentService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";
import type { MapDataLayer } from "@/types/map";
import type { NewsIncident, NewsIncidentTypeFilter } from "@/types/news";

const defaultFilters = getDefaultCrimeMapFilters();
const defaultNewsFilters = getDefaultNewsIncidentFilters();
const indicators = getAvailableIndicators();
const newsTypes = getAvailableNewsIncidentTypes();
const periods = getAvailablePeriods();
const demoStatus = getDemoDataStatus();
const newsStatus = getNewsDataStatus();
const officialDataLabel =
  demoStatus.mode === "official_sample"
    ? "Amostra oficial: homicidio doloso (vitimas)"
    : demoStatus.mode === "official"
      ? "Dados oficiais agregados"
      : "Dados demonstrativos nesta versao";

export function CrimeDashboard() {
  const [indicator, setIndicator] = useState<CrimeIndicatorKey>(defaultFilters.indicator);
  const [mapLayer, setMapLayer] = useState<MapDataLayer>("official");
  const [newsConfidenceMin, setNewsConfidenceMin] = useState(defaultNewsFilters.minConfidence);
  const [newsType, setNewsType] = useState<NewsIncidentTypeFilter>(defaultNewsFilters.type);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultFilters.viewMode);
  const [period, setPeriod] = useState(defaultFilters.period);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<MunicipalityCrimeData | null>(null);
  const [selectedNewsIncident, setSelectedNewsIncident] = useState<NewsIncident | null>(null);

  const mapResult = useMemo(
    () => getCrimeMapData({ indicator, period, viewMode, uf: null }),
    [indicator, period, viewMode],
  );
  const rankingResult = useMemo(
    () => getCrimeMapData({ indicator, period, viewMode, uf: selectedState }),
    [indicator, period, selectedState, viewMode],
  );
  const newsResult = useMemo(
    () =>
      getNewsIncidentData({
        period,
        type: newsType,
        minConfidence: newsConfidenceMin,
        uf: selectedState,
      }),
    [newsConfidenceMin, newsType, period, selectedState],
  );
  const currentData = mapResult.items;
  const visibleMapData = selectedState ? rankingResult.items : currentData;
  const officialLayerData = mapLayer === "news" ? [] : visibleMapData;
  const visibleNewsIncidents = mapLayer === "official" ? [] : newsResult.items;
  const ranking = rankingResult.ranking;

  const selectedPeriod = periods.find((option) => option.key === period) ?? periods[0];

  function handleStateSelect(uf: string) {
    setSelectedState(uf);
    setSelectedMunicipality(null);
    setSelectedNewsIncident(null);
  }

  function handleMunicipalitySelect(item: MunicipalityCrimeData) {
    setSelectedState(item.uf);
    setSelectedMunicipality(item);
    setSelectedNewsIncident(null);
  }

  function handleNewsIncidentSelect(item: NewsIncident) {
    setSelectedState(item.uf);
    setSelectedMunicipality(null);
    setSelectedNewsIncident(item);
  }

  function handleBackToBrazil() {
    setSelectedState(null);
    setSelectedMunicipality(null);
    setSelectedNewsIncident(null);
  }

  function handleBackToState() {
    setSelectedMunicipality(null);
    setSelectedNewsIncident(null);
  }

  return (
    <main className="flex min-h-screen flex-col overflow-hidden text-slate-100">
      <AppHeader />
      <section className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)_340px] lg:p-5">
        <aside className="flex min-h-0 flex-col gap-4">
          <CrimeFilters
            indicator={indicator}
            indicators={indicators}
            mapLayer={mapLayer}
            newsConfidenceMin={newsConfidenceMin}
            newsType={newsType}
            newsTypes={newsTypes}
            period={period}
            periods={periods}
            viewMode={viewMode}
            onIndicatorChange={(next) => {
              setIndicator(next);
              setSelectedMunicipality(null);
            }}
            onMapLayerChange={(next) => {
              setMapLayer(next);
              setSelectedMunicipality(null);
              setSelectedNewsIncident(null);
            }}
            onNewsConfidenceMinChange={(next) => {
              setNewsConfidenceMin(next);
              setSelectedNewsIncident(null);
            }}
            onNewsTypeChange={(next) => {
              setNewsType(next);
              setSelectedNewsIncident(null);
            }}
            onPeriodChange={(next) => {
              setPeriod(next);
              setSelectedMunicipality(null);
              setSelectedNewsIncident(null);
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
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-100 backdrop-blur">
              <AlertTriangle className="h-4 w-4" />
              {officialDataLabel}
            </div>
          </div>

          <BrazilCrimeMap
            data={officialLayerData}
            indicator={indicator}
            newsIncidents={visibleNewsIncidents}
            selectedMunicipality={selectedMunicipality}
            selectedNewsIncident={selectedNewsIncident}
            selectedState={selectedState}
            viewMode={viewMode}
            onMunicipalitySelect={handleMunicipalitySelect}
            onNewsIncidentSelect={handleNewsIncidentSelect}
            onStateSelect={handleStateSelect}
          />

          {mapLayer !== "news" ? (
            <div className="absolute bottom-4 left-4 z-10">
              <MapLegend />
            </div>
          ) : (
            <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-amber-300/20 bg-slate-950/85 px-3 py-2 text-xs text-slate-300 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-slate-950 bg-amber-400" />
                Noticias OSINT demonstrativas
              </div>
            </div>
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
                <span className="text-slate-500">Periodo:</span> {selectedPeriod.label}
              </p>
              <p>
                <span className="text-slate-500">Atualizado:</span> {demoStatus.lastUpdated}
              </p>
            </div>
          </div>
          {mapLayer !== "official" ? (
            <NewsIncidentsPanel
              incidents={visibleNewsIncidents}
              selectedIncident={selectedNewsIncident}
              status={newsStatus}
              summary={newsResult.summary}
              onSelect={handleNewsIncidentSelect}
            />
          ) : null}
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
