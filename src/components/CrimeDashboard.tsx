"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CrimeFilters } from "@/components/filters/CrimeFilters";
import { BrazilCrimeMap } from "@/components/map/BrazilCrimeMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { MunicipalityDetailsPanel } from "@/components/panels/MunicipalityDetailsPanel";
import { RankingPanel } from "@/components/panels/RankingPanel";
import {
  getAvailableIndicators,
  getAvailablePeriods,
  getCrimeMapData,
  getDefaultCrimeMapFilters,
  getDemoDataStatus,
} from "@/services/crimeDataService";
import type { CrimeIndicatorKey, MunicipalityCrimeData, ViewMode } from "@/types/crime";

const defaultFilters = getDefaultCrimeMapFilters();
const indicators = getAvailableIndicators();
const periods = getAvailablePeriods();
const demoStatus = getDemoDataStatus();

export function CrimeDashboard() {
  const [indicator, setIndicator] = useState<CrimeIndicatorKey>(defaultFilters.indicator);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultFilters.viewMode);
  const [period, setPeriod] = useState(defaultFilters.period);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<MunicipalityCrimeData | null>(null);

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
      <AppHeader />
      <section className="flex flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)_340px] lg:p-5">
        <aside className="flex min-h-0 flex-col gap-4">
          <CrimeFilters
            indicator={indicator}
            indicators={indicators}
            period={period}
            periods={periods}
            viewMode={viewMode}
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
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-medium text-amber-100 backdrop-blur">
              <AlertTriangle className="h-4 w-4" />
              Dados demonstrativos nesta versao
            </div>
          </div>

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
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Status da base</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-slate-500">Fonte:</span> {demoStatus.source}
              </p>
              <p>
                <span className="text-slate-500">Periodo:</span> {selectedPeriod.label}
              </p>
              <p>
                <span className="text-slate-500">Atualizado:</span> {demoStatus.lastUpdated}
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
