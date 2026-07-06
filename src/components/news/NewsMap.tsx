"use client";

import { useEffect, useRef } from "react";
import { mapTileAttribution, mapTileUrls } from "@/lib/mapConfig";
import { confidenceColor, NEWS_TYPE_LABEL, confidencePct } from "@/lib/newsDisplay";
import type { NewsIncident } from "@/types/news";

// Mapa leve da camada OSINT: marcadores DOM (circulos) para os incidentes
// geolocalizados. Distinto do coropletico oficial — esta e a camada de noticias.
export function NewsMap({
  incidents,
  onSelect,
}: {
  incidents: NewsIncident[];
  onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // mantem a callback atual sem recriar o mapa (atualizada fora do render)
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const geocoded = incidents.filter((i) => typeof i.lat === "number" && typeof i.lng === "number");
  // chave estavel: muda so quando o conjunto de pontos muda
  const pointsKey = geocoded.map((i) => i.id).join(",");

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
          center: [-52, -14],
          zoom: 3.1,
          attributionControl: false,
          style: {
            version: 8,
            sources: {
              base: { type: "raster", tiles: mapTileUrls, tileSize: 256, attribution: mapTileAttribution },
            },
            layers: [{ id: "base", type: "raster", source: "base", paint: { "raster-opacity": 0.7 } }],
          },
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        for (const inc of geocoded) {
          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute("aria-label", `${NEWS_TYPE_LABEL[inc.tipo]} em ${inc.municipio}/${inc.uf}`);
          el.style.cssText = `width:14px;height:14px;border-radius:9999px;border:2px solid #0A0B0D;cursor:pointer;background:${confidenceColor(inc.confianca)};box-shadow:0 0 0 1px rgba(255,255,255,.14)`;
          const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
            `<div style="font:12px system-ui;max-width:220px;color:#0b1120">
               <strong>${NEWS_TYPE_LABEL[inc.tipo]}</strong> — ${inc.municipio}/${inc.uf}<br/>
               <span style="color:#475569">${confidencePct(inc.confianca)} · ${inc.veiculo}</span><br/>
               <a href="${inc.fonteUrl}" target="_blank" rel="noopener noreferrer">ver notícia ↗</a>
             </div>`,
          );
          el.addEventListener("click", () => onSelectRef.current?.(inc.id));
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([inc.lng as number, inc.lat as number])
            .setPopup(popup)
            .addTo(map);
          markers.push(marker);
        }
      } catch {
        // sem mapa: a lista de cards continua a funcionar (degrade gracioso)
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

  return <div ref={containerRef} className="h-full w-full" role="img" aria-label="Mapa de indícios de notícias" />;
}
