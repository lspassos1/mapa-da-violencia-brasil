"use client";

import { useEffect, useRef } from "react";
import { mapTileAttribution, mapTileUrls } from "@/lib/mapConfig";
import type { ShootingOccurrence } from "@/server/shootings/fogocruzado";
import type { OsintPoint } from "@/server/shootings/crossref";

// Cores de contexto — semântica do handoff (decisão #3: "outro" é CINZA;
// âmbar #E2A33B é EXCLUSIVO de indício/OSINT).
export const CONTEXTO_COR: Record<ShootingOccurrence["contexto"], string> = {
  disputa: "#E5484D", // guerra entre grupos
  policia: "#4FA0E8", // ação/operação policial
  outro: "#9BA3AF", // contexto neutro
};
export const CONTEXTO_LABEL: Record<ShootingOccurrence["contexto"], string> = {
  disputa: "Disputa entre grupos",
  policia: "Ação policial",
  outro: "Outro contexto",
};

const INDICIO = "#E2A33B";
const H24 = 24 * 3600 * 1000;

// Escapa strings da API antes de injetar no popup (setHTML usa innerHTML → XSS).
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Popup no tema do instrumento: painel escuro quadrado com border-top de 2px
// na cor semântica (registro = contexto; indício = âmbar).
function popupHtml(accent: string, kind: string, title: string, sub: string, meta: string): string {
  return `<div style="width:250px;background:rgba(12,13,16,.96);border:1px solid #2A2F37;border-top:2px solid ${accent};padding:11px 13px;backdrop-filter:blur(6px)">
    <div style="font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:.2em;color:${accent};margin-bottom:5px">${kind}</div>
    <div style="font-family:var(--font-sans),sans-serif;font-size:13.5px;font-weight:600;color:#ECEAE4">${title}</div>
    <div style="font-family:var(--font-mono),monospace;font-size:10px;color:#A6AAB2;margin-top:4px;line-height:1.6">${sub}</div>
    <div style="font-family:var(--font-mono),monospace;font-size:9.5px;color:#565B63;margin-top:3px">${meta}</div>
  </div>`;
}

// Mapa de tiroteios (MapLibre real — decisão #1: manter zoom/pan/fitBounds).
// Duas camadas DISTINTAS: Fogo Cruzado (círculos sólidos por contexto, halo
// pulsante quando <24h) e OSINT (losango âmbar vazado, precisão municipal).
// Varredura de radar em overlay CSS contínuo. Degrade gracioso sem mapa.
export function ShootingsMap({
  ocorrencias,
  osint = [],
  focus = null,
  highlightId = null,
  onHover,
  sweep = true,
}: {
  ocorrencias: ShootingOccurrence[];
  osint?: OsintPoint[];
  focus?: { lat: number; lng: number } | null; // "perto de mim": centra + marca o usuário
  highlightId?: string | null; // sincronização feed → mapa
  onHover?: (id: string | null) => void; // sincronização mapa → feed
  sweep?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  const geo = ocorrencias.filter((o) => typeof o.lat === "number" && typeof o.lng === "number");
  const focusKey = focus ? `${focus.lat.toFixed(3)},${focus.lng.toFixed(3)}` : "";
  const pointsKey = geo.map((o) => o.id).join(",") + "|" + osint.map((p) => p.id).join(",") + "|" + focusKey;

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let markers: import("maplibre-gl").Marker[] = [];
    let cancelled = false;
    const els = markerElsRef.current;

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
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#0B0C0F" } },
              { id: "base", type: "raster", source: "base", paint: { "raster-opacity": 0.62 } },
            ],
          },
        });
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        const bounds = new maplibregl.LngLatBounds();
        const now = Date.now();

        const track = (id: string, el: HTMLElement) => {
          els.set(id, el);
          if (onHoverRef.current) {
            el.addEventListener("mouseenter", () => onHoverRef.current?.(id));
            el.addEventListener("mouseleave", () => onHoverRef.current?.(null));
          }
        };

        // Camada Fogo Cruzado (círculos sólidos por contexto; tamanho ∝ mortos;
        // halo pulsante contínuo quando a ocorrência tem <24h).
        for (const o of geo) {
          const cor = CONTEXTO_COR[o.contexto];
          const tamanho = 10 + Math.min(o.mortos * 3, 12);
          const el = document.createElement("div");
          el.style.cssText = `width:${tamanho}px;height:${tamanho}px`;
          const recente = now - Date.parse(o.data) < H24;
          if (recente) {
            const halo = document.createElement("div");
            halo.className = "halo-24h";
            halo.style.cssText = `position:absolute;inset:0;border-radius:9999px;border:1px solid ${cor}`;
            el.appendChild(halo);
          }
          const dot = document.createElement("div");
          dot.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${cor};border:1.5px solid #0A0B0D;box-shadow:0 0 0 1px rgba(255,255,255,.14)`;
          el.appendChild(dot);
          track(o.id, el);
          const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
            popupHtml(
              cor,
              "● REGISTRO — FOGO CRUZADO",
              `${o.bairro ? esc(o.bairro) + " — " : ""}${esc(o.municipio)}/${esc(o.estado)}`,
              `${esc(CONTEXTO_LABEL[o.contexto].toLowerCase())} · ${o.mortos} morto(s) · ${o.feridos} ferido(s)`,
              `${esc(o.data.slice(0, 10))} · geolocalização exata`,
            ),
          );
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([o.lng as number, o.lat as number]).setPopup(popup).addTo(map));
          bounds.extend([o.lng as number, o.lat as number]);
        }

        // Camada OSINT (losango âmbar vazado — precisão municipal, indício).
        // O maplibre controla o transform do ELEMENTO do marcador (posição), então
        // a rotação do losango vai num filho interno p/ não ser sobrescrita.
        for (const p of osint) {
          const el = document.createElement("div");
          el.style.cssText = "width:13px;height:13px";
          const shape = document.createElement("div");
          shape.style.cssText = `width:11px;height:11px;margin:1px;transform:rotate(45deg);background:rgba(226,163,59,.13);border:1px solid ${INDICIO};box-shadow:0 0 0 1px rgba(0,0,0,.3)`;
          el.appendChild(shape);
          track(p.id, el);
          const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
            popupHtml(
              INDICIO,
              "◆ INDÍCIO DE NOTÍCIA — OSINT",
              `${esc(p.municipio)} / ${esc(p.uf)}`,
              `“${esc(p.titulo).slice(0, 110)}”`,
              `${p.veiculo ? esc(p.veiculo) + " · " : ""}${p.data ? esc(p.data) + " · " : ""}precisão municipal — indício, não registro`,
            ),
          );
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map));
          bounds.extend([p.lng, p.lat]);
        }

        // "Perto de mim": marca o usuário (VOCÊ, azul pulsante) e centra nele;
        // senão, enquadra todos os pontos (FC + OSINT).
        if (focus) {
          const el = document.createElement("div");
          el.style.cssText = "width:14px;height:14px";
          el.innerHTML =
            `<div class="halo-24h" style="position:absolute;inset:0;border-radius:9999px;border:1px solid #4FA0E8"></div>` +
            `<div style="position:absolute;inset:0;border-radius:9999px;background:#4FA0E8;border:1.5px solid #fff"></div>` +
            `<div style="position:absolute;left:50%;top:-16px;transform:translateX(-50%);font-family:var(--font-mono),monospace;font-size:9px;letter-spacing:.1em;color:#9CC8F0;text-shadow:0 1px 2px rgba(0,0,0,.8)">VOCÊ</div>`;
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([focus.lng, focus.lat]).addTo(map));
          map.jumpTo({ center: [focus.lng, focus.lat], zoom: 10 });
        } else if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 56, maxZoom: 9, duration: 0 });
        }
      } catch {
        // sem mapa: a lista continua (degrade gracioso)
      }
    })();

    return () => {
      cancelled = true;
      els.clear();
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Sincronização feed → mapa: destaca o marcador sob hover/seleção no feed
  // sem recriar o mapa (só classe CSS no elemento do marcador).
  useEffect(() => {
    const els = markerElsRef.current;
    if (highlightId) {
      const el = els.get(highlightId);
      if (el) {
        el.style.outline = "1.5px solid #ECEAE4";
        el.style.outlineOffset = "2.5px";
        el.style.zIndex = "5";
      }
    }
    return () => {
      if (highlightId) {
        const el = els.get(highlightId);
        if (el) {
          el.style.outline = "";
          el.style.outlineOffset = "";
          el.style.zIndex = "";
        }
      }
    };
  }, [highlightId]);

  return (
    <div className="relative h-full w-full bg-maparea">
      <div ref={containerRef} className="h-full w-full" role="img" aria-label="Mapa de tiroteios recentes" />
      {sweep ? <div className="map-sweep" aria-hidden="true" /> : null}
      {/* vinheta editorial sobre o mapa (não intercepta o mouse) */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(10,11,13,.55) 100%)" }}
        aria-hidden="true"
      />
    </div>
  );
}
