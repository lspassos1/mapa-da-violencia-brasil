"use client";

import { useEffect, useRef } from "react";
import { mapTileAttribution, mapTileUrls } from "@/lib/mapConfig";
import type { ShootingOccurrence } from "@/server/shootings/fogocruzado";
import type { OsintPoint } from "@/server/shootings/crossref";

export const CONTEXTO_COR: Record<ShootingOccurrence["contexto"], string> = {
  disputa: "#ef4444", // guerra entre grupos
  policia: "#38bdf8", // ação/operação policial
  outro: "#f59e0b",
};
export const CONTEXTO_LABEL: Record<ShootingOccurrence["contexto"], string> = {
  disputa: "Disputa entre grupos",
  policia: "Ação policial",
  outro: "Outro",
};

// Escapa strings da API antes de injetar no popup (setHTML usa innerHTML → XSS).
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mapa leve de tiroteios. Duas camadas DISTINTAS:
//  - Fogo Cruzado (círculos sólidos, geo exata, por contexto)
//  - OSINT (losangos âmbar vazados, precisão MUNICIPAL, indício de notícia)
// Degrade gracioso: se o mapa falhar, a lista continua.
export function ShootingsMap({ ocorrencias, osint = [] }: { ocorrencias: ShootingOccurrence[]; osint?: OsintPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const geo = ocorrencias.filter((o) => typeof o.lat === "number" && typeof o.lng === "number");
  const pointsKey = geo.map((o) => o.id).join(",") + "|" + osint.map((p) => p.id).join(",");

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let markers: import("maplibre-gl").Marker[] = [];
    let cancelled = false;

    (async () => {
      if (!containerRef.current) return;
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          center: [-43.2, -22.9], // fallback: RJ (praça principal do Fogo Cruzado)
          zoom: 8,
          attributionControl: false,
          style: {
            version: 8,
            sources: { base: { type: "raster", tiles: mapTileUrls, tileSize: 256, attribution: mapTileAttribution } },
            layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-opacity": 0.7 } }],
          },
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        const bounds = new maplibregl.LngLatBounds();

        // Camada Fogo Cruzado (círculos sólidos por contexto; tamanho ∝ mortos).
        for (const o of geo) {
          const el = document.createElement("div");
          const tamanho = 9 + Math.min(o.mortos * 3, 12);
          el.style.cssText = `width:${tamanho}px;height:${tamanho}px;border-radius:9999px;border:2px solid #0b1120;background:${CONTEXTO_COR[o.contexto]};box-shadow:0 0 0 1px rgba(255,255,255,.25)`;
          const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(
            `<div style="font:12px system-ui;max-width:230px;color:#0b1120">
               <strong>${CONTEXTO_LABEL[o.contexto]}</strong><br/>
               ${o.bairro ? esc(o.bairro) + " — " : ""}${esc(o.municipio)}/${esc(o.estado)}<br/>
               <span style="color:#475569">${esc(o.data.slice(0, 10))} · ${o.mortos} morto(s), ${o.feridos} ferido(s)</span>
             </div>`,
          );
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([o.lng as number, o.lat as number]).setPopup(popup).addTo(map));
          bounds.extend([o.lng as number, o.lat as number]);
        }

        // Camada OSINT (losango âmbar vazado — precisão municipal, indício).
        for (const p of osint) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:11px;height:11px;transform:rotate(45deg);background:rgba(245,158,11,.18);border:1.5px solid #f59e0b;box-shadow:0 0 0 1px rgba(0,0,0,.3)";
          const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(
            `<div style="font:12px system-ui;max-width:240px;color:#0b1120">
               <strong>📰 Indício de notícia</strong> · ${esc(p.tipo)}<br/>
               ${esc(p.municipio)}/${esc(p.uf)} <span style="color:#b45309">· precisão municipal</span><br/>
               <span style="color:#334155">${esc(p.titulo).slice(0, 110)}</span><br/>
               <span style="color:#64748b">${p.veiculo ? esc(p.veiculo) + " · " : ""}${p.data ? esc(p.data) : ""}</span>
             </div>`,
          );
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map));
          bounds.extend([p.lng, p.lat]);
        }

        // Enquadra todos os pontos (FC + OSINT). maxZoom evita zoom excessivo com
        // poucos pontos; só ajusta se houver algo.
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 9, duration: 0 });
      } catch {
        // sem mapa: a lista continua (degrade gracioso)
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  return <div ref={containerRef} className="h-full w-full" role="img" aria-label="Mapa de tiroteios recentes" />;
}
