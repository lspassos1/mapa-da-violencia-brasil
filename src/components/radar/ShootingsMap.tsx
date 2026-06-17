"use client";

import { useEffect, useRef } from "react";
import { mapTileAttribution, mapTileUrls } from "@/lib/mapConfig";
import type { ShootingOccurrence } from "@/server/shootings/fogocruzado";

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

// Mapa leve de tiroteios (marcadores DOM por contexto). Distinto das camadas
// oficial/OSINT. Degrade gracioso: se o mapa falhar, a lista continua.
export function ShootingsMap({ ocorrencias }: { ocorrencias: ShootingOccurrence[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const geo = ocorrencias.filter((o) => typeof o.lat === "number" && typeof o.lng === "number");
  const pointsKey = geo.map((o) => o.id).join(",");

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
          center: [-43.2, -22.9], // RJ (praça principal do Fogo Cruzado)
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

        for (const o of geo) {
          const el = document.createElement("div");
          const tamanho = 9 + Math.min(o.mortos * 3, 12); // mortos = marcador maior
          el.style.cssText = `width:${tamanho}px;height:${tamanho}px;border-radius:9999px;border:2px solid #0b1120;background:${CONTEXTO_COR[o.contexto]};box-shadow:0 0 0 1px rgba(255,255,255,.25)`;
          const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(
            `<div style="font:12px system-ui;max-width:230px;color:#0b1120">
               <strong>${CONTEXTO_LABEL[o.contexto]}</strong><br/>
               ${o.bairro ? o.bairro + " — " : ""}${o.municipio}/${o.estado}<br/>
               <span style="color:#475569">${o.data.slice(0, 10)} · ${o.mortos} morto(s), ${o.feridos} ferido(s)</span>
             </div>`,
          );
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([o.lng as number, o.lat as number]).setPopup(popup).addTo(map));
        }
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
