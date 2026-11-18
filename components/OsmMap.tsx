"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLngBounds, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { COMPANY_ZOOM, companyPinsFrom, pinDomId, pinKey, type CompanyPin, type Pin } from "@/lib/experiences";
import type { Experience } from "@/lib/types";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

async function loadLeaflet() {
  const imported = await import("leaflet");
  return (imported.default ?? imported) as typeof imported;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const named: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return named[character];
  });
}

function placeDomId(pin: { organization: string; city: string }) {
  const slug = `${pin.organization}-${pin.city}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `place-${slug}`;
}

function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const north = (aLat - bLat) * 111;
  const east = (aLng - bLng) * 111 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(north, east);
}

type MarkerModel = {
  key: string;
  lat: number;
  lng: number;
  city: string;
  region: string;
  label: string;
  title: string;
  count: number;
  testId: string;
  organization?: string;
  query?: string;
};

function cityModels(pins: Pin[], selectedKey: string | null): MarkerModel[] {
  return pins.map((pin) => {
    const place = pin.region ? `${pin.city}, ${pin.region}` : pin.city;
    return {
      key: pin.key,
      lat: pin.lat,
      lng: pin.lng,
      city: pin.city,
      region: pin.region,
      label: pin.city,
      title: `${place}, ${pin.count} ${pin.count === 1 ? "experience" : "experiences"}`,
      count: pin.count,
      testId: pinDomId(pin),
    };
  });
}

function nearView(bounds: LatLngBounds | null, lat: number, lng: number) {
  if (!bounds) return true;
  const latPad = Math.max(0.15, (bounds.getNorth() - bounds.getSouth()) * 0.6);
  const lngPad = Math.max(0.15, (bounds.getEast() - bounds.getWest()) * 0.6);
  return lat >= bounds.getSouth() - latPad && lat <= bounds.getNorth() + latPad && lng >= bounds.getWest() - lngPad && lng <= bounds.getEast() + lngPad;
}

function companyModels(
  records: Experience[],
  bounds: LatLngBounds | null,
  places: Record<string, { lat: number; lng: number }>,
  selectedKey: string | null,
): MarkerModel[] {
  const selectedCity = selectedKey?.startsWith("org:") ? selectedKey.slice(4).split("::")[0] : selectedKey;
  const visible = records.filter((record) => (selectedCity != null && pinKey(record) === selectedCity) || nearView(bounds, record.lat, record.lng));
  const pins = companyPinsFrom(visible);
  const cityCenters = new Map<string, { lat: number; lng: number }>();
  for (const record of visible) {
    if (!cityCenters.has(pinKey(record))) cityCenters.set(pinKey(record), { lat: record.lat, lng: record.lng });
  }
  return pins.map((pin: CompanyPin) => {
    const center = cityCenters.get(pinKey(pin)) ?? { lat: pin.lat, lng: pin.lng };
    const found = places[pin.key];
    const located = found && kmBetween(found.lat, found.lng, center.lat, center.lng) <= 40 ? found : null;
    const place = pin.region ? `${pin.city}, ${pin.region}` : pin.city;
    return {
      key: pin.key,
      lat: located?.lat ?? pin.lat,
      lng: located?.lng ?? pin.lng,
      city: pin.city,
      region: pin.region,
      organization: pin.organization,
      label: pin.organization,
      title: `${pin.organization}, ${place}, ${pin.count} ${pin.count === 1 ? "experience" : "experiences"}`,
      count: pin.count,
      testId: placeDomId(pin),
      query: `${pin.organization}, ${pin.city}`,
    };
  });
}

export function OsmMap({
  pins,
  records,
  selectedKey,
  onSelect,
}: {
  pins: Pin[];
  records: Experience[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const pinsRef = useRef(pins);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [boundsKey, setBoundsKey] = useState("");
  const [places, setPlaces] = useState<Record<string, { lat: number; lng: number }>>({});
  const askedRef = useRef(new Set<string>());
  onSelectRef.current = onSelect;
  pinsRef.current = pins;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    (async () => {
      const leaflet = await loadLeaflet();
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, {
        center: [22, 12],
        zoom: 2,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: false,
        worldCopyJump: true,
        attributionControl: true,
      });
      leaflet
        .tileLayer(TILES, {
          maxZoom: 19,
          attribution: ATTRIBUTION,
        })
        .addTo(map);
      mapRef.current = map;
      const sync = () => {
        const nextZoom = map.getZoom();
        setZoom(nextZoom);
        if (nextZoom >= COMPANY_ZOOM) {
          const bounds = map.getBounds();
          setBoundsKey([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map((value) => value.toFixed(3)).join(","));
        }
      };
      map.on("zoomend", sync);
      map.on("moveend", sync);
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      (map as LeafletMap & { __observer?: ResizeObserver }).__observer = observer;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      const current = mapRef.current as (LeafletMap & { __observer?: ResizeObserver }) | null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      current?.__observer?.disconnect();
      current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    const bounds = zoom >= COMPANY_ZOOM ? map.getBounds().pad(0.5) : null;
    const models = zoom >= COMPANY_ZOOM ? companyModels(records, bounds, places, selectedKey) : cityModels(pins, selectedKey);

    (async () => {
      const leaflet = await loadLeaflet();
      if (cancelled || mapRef.current !== map) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = models.map((model) => {
        const selected = selectedKey === model.key || (model.organization == null && selectedKey?.startsWith(`org:${model.key}::`));
        const icon = leaflet.divIcon({
          className: "osm-pin",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          html: `<button type="button" class="${selected ? "pin is-selected" : "pin"}${model.organization ? " is-place" : ""}" data-testid="${escapeHtml(model.testId)}" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeHtml(model.title)}"><span class="pin-count" aria-hidden="true">${model.count}</span><span class="pin-name" aria-hidden="true">${escapeHtml(model.label)}</span></button>`,
        });
        const marker = leaflet.marker([model.lat, model.lng], { icon, keyboard: false, zIndexOffset: selected ? 800 : 0 }).addTo(map);
        const choose = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectRef.current(selected ? null : model.key);
        };
        marker.getElement()?.addEventListener("click", choose, true);
        marker.on("mouseover", () => marker.setZIndexOffset(1000));
        marker.on("mouseout", () => marker.setZIndexOffset(selected ? 800 : 0));
        return marker;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pins, records, selectedKey, ready, zoom, boundsKey, places]);

  useEffect(() => {
    if (!ready || zoom < COMPANY_ZOOM) return;
    const map = mapRef.current;
    if (!map) return;
    const pending = companyModels(records, map.getBounds(), {}, selectedKey).filter((model) => model.query && !askedRef.current.has(model.key));
    let cancelled = false;
    pending.forEach((model) => {
      const query = model.query;
      if (!query) return;
      askedRef.current.add(model.key);
      fetch(`/api/place?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((point: { lat?: number | null; lng?: number | null }) => {
          if (cancelled || typeof point.lat !== "number" || typeof point.lng !== "number") return;
          setPlaces((current) => (current[model.key] ? current : { ...current, [model.key]: { lat: point.lat as number, lng: point.lng as number } }));
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, zoom, boundsKey, records, selectedKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedKey || selectedKey.startsWith("org:")) return;
    const pin = pinsRef.current.find((item) => item.key === selectedKey);
    if (!pin) return;
    const nextZoom = Math.max(map.getZoom(), 5);
    map.flyTo([pin.lat, pin.lng], nextZoom, { duration: 0.45 });
  }, [selectedKey, ready]);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.stop();
    if (delta > 0) map.zoomIn(delta);
    else map.zoomOut(-delta);
  }

  function resetView() {
    mapRef.current?.setView([22, 12], 2);
  }

  return (
    <>
      <div ref={containerRef} className="osm-map" data-zoom={zoom} />
      <div className="globe-nav" role="group" aria-label="Move the map" onPointerDown={(event) => event.stopPropagation()}>
        <span className="globe-nav-label">Zoom</span>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)}>
          +
        </button>
        <span className="globe-nav-gap" aria-hidden="true" />
        <button type="button" className="globe-nav-reset" onClick={resetView}>
          Reset
        </button>
      </div>
      <p className="globe-hint osm-hint">Drag to move. Zoom in to separate companies.</p>
    </>
  );
}
