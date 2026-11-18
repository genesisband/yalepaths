"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { pinDomId, type Pin } from "@/lib/experiences";
import { isFacing } from "@/lib/globe";

type StyleLayer = { id: string; type: string; source?: string; "source-layer"?: string };

export function MapboxGlobe({
  token,
  pins,
  selectedKey,
  onSelect,
  onFail,
}: {
  token: string;
  pins: Pin[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onFail: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const onFailRef = useRef(onFail);
  onSelectRef.current = onSelect;
  onFailRef.current = onFail;

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cancelled = false;
    let map: MapboxMap | null = null;
    const timer = window.setTimeout(() => onFailRef.current(), 8000);

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/light-v11",
        projection: "globe",
        center: [12, 22],
        zoom: 1.55,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.on("style.load", () => {
        if (!map) return;
        map.setFog({
          color: "#F7F4ED",
          "high-color": "#D7E6F2",
          "horizon-blend": 0.06,
          "space-color": "#E6EEF5",
          "star-intensity": 0,
        });
        const layers = (map.getStyle()?.layers ?? []) as StyleLayer[];
        for (const layer of layers) {
          if (/(road|tunnel|bridge|building|poi|transit|airport|rail|ferry|path|landuse|landcover|hillshade|contour|waterway|settlement-subdivision|settlement-minor|state-label)/.test(layer.id)) {
            try {
              map.setLayoutProperty(layer.id, "visibility", "none");
            } catch {
              /* Some style layers reject visibility changes. */
            }
          }
          if (layer.type === "background") {
            try {
              map.setPaintProperty(layer.id, "background-color", "#D5E4F0");
            } catch {
              /* Keep the published color when the layer rejects the change. */
            }
          }
          if (layer.type === "fill" && layer.id.includes("water")) {
            try {
              map.setPaintProperty(layer.id, "fill-color", "#F7F4ED");
            } catch {
              /* Keep the published color when the layer rejects the change. */
            }
          }
        }
        const water = layers.find((layer) => layer.id === "water" && layer.type === "fill");
        if (water?.source && !map.getLayer("atlas-coast")) {
          map.addLayer({
            id: "atlas-coast",
            type: "line",
            source: water.source,
            "source-layer": water["source-layer"],
            paint: { "line-color": "#00356B", "line-width": 0.6, "line-opacity": 0.45 },
          });
        }
      });
      map.on("load", () => window.clearTimeout(timer));
      map.on("error", (event) => {
        const message = String(event.error?.message || "");
        if (/token|unauthorized|401|403|forbidden/i.test(message)) onFailRef.current();
      });
      const observer = new ResizeObserver(() => map?.resize());
      observer.observe(container);
      if (cancelled) return;
      (map as MapboxMap & { __observer?: ResizeObserver }).__observer = observer;
    })().catch(() => onFailRef.current());

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const current = mapRef.current as (MapboxMap & { __observer?: ResizeObserver; __markers?: Marker[]; __hideFarSide?: () => void }) | null;
      if (current?.__hideFarSide) current.off("move", current.__hideFarSide);
      current?.__markers?.forEach((marker) => marker.remove());
      current?.__observer?.disconnect();
      current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const draw = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      const current = mapRef.current as (MapboxMap & { __markers?: Marker[]; __hideFarSide?: () => void }) | null;
      if (!current || cancelled) return;
      if (current.__hideFarSide) current.off("move", current.__hideFarSide);
      current.__markers?.forEach((marker) => marker.remove());
      current.__markers = pins.map((pin) => {
        const selected = selectedKey === pin.key;
        const element = document.createElement("button");
        element.type = "button";
        element.className = selected ? "pin is-selected" : "pin";
        element.dataset.testid = pinDomId(pin);
        element.setAttribute("aria-pressed", String(selected));
        const place = pin.region ? `${pin.city}, ${pin.region}` : pin.city;
        element.setAttribute("aria-label", `${place}, ${pin.count} ${pin.count === 1 ? "experience" : "experiences"}`);
        const count = document.createElement("span");
        count.className = "pin-count";
        count.setAttribute("aria-hidden", "true");
        count.textContent = String(pin.count);
        const name = document.createElement("span");
        name.className = "pin-name";
        name.setAttribute("aria-hidden", "true");
        name.textContent = pin.city;
        element.append(count, name);
        element.dataset.lng = String(pin.lng);
        element.dataset.lat = String(pin.lat);
        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectRef.current(selected ? null : pin.key);
        });
        return new mapboxgl.Marker({ element, anchor: "left" }).setLngLat([pin.lng, pin.lat]).addTo(current);
      });
      const hideFarSide = () => {
        const center = current.getCenter();
        for (const marker of current.__markers ?? []) {
          const element = marker.getElement();
          const lng = Number(element.dataset.lng);
          const lat = Number(element.dataset.lat);
          element.style.visibility = isFacing(lng, lat, center.lng, center.lat) ? "visible" : "hidden";
        }
      };
      hideFarSide();
      current.__hideFarSide = hideFarSide;
      current.on("move", hideFarSide);
    };

    if (map.loaded()) void draw();
    else map.once("load", () => void draw());
    return () => {
      cancelled = true;
    };
  }, [pins, selectedKey]);

  return <div ref={ref} className="mapbox-root" data-testid="mapbox-globe" />;
}
