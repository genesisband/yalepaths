"use client";

import { useEffect, useRef } from "react";
import { geoOrthographic, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { PinButton } from "@/components/PinButton";
import type { Pin } from "@/lib/experiences";
import { countryPieces, europeBorderAlpha, europeLabelAlpha, isFacing, isInView, largestNearbySpan, projectionCenter, type CountryPiece } from "@/lib/globe";

type PlaceLabel = { name: string; lng: number; lat: number; europeSpan: number | null };

const CONTINENTS = [
  { name: "Europe", lng: 10, lat: 50 },
  { name: "Africa", lng: 18, lat: 4 },
  { name: "Asia", lng: 88, lat: 42 },
  { name: "North America", lng: -100, lat: 46 },
  { name: "South America", lng: -60, lat: -16 },
  { name: "Australia", lng: 134, lat: -25 },
];

const MIN_SCALE = 0.75;
const MAX_SCALE = 9;

function clampScale(value: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

function clampPhi(value: number) {
  return Math.max(-80, Math.min(80, value));
}

/** 0 below `start`, 1 above `end`, linear between. */
function fadeIn(scale: number, start: number, end: number) {
  if (scale <= start) return 0;
  if (scale >= end) return 1;
  return (scale - start) / (end - start);
}

export function PaperGlobe({
  pins,
  selectedKey,
  onSelect,
}: {
  pins: Pin[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ lambda: -12, phi: -22, scale: 1 });
  const sizeRef = useRef({ width: 640, height: 640 });
  const geo = useRef<{
    land: GeoPermissibleObjects | null;
    countries: CountryPiece[] | null;
    europe: CountryPiece[] | null;
    states: CountryPiece[] | null;
    stateLabels: PlaceLabel[] | null;
    countryLabels: PlaceLabel[] | null;
  }>({ land: null, countries: null, europe: null, states: null, stateLabels: null, countryLabels: null });
  const drag = useRef<{ x: number; y: number; lambda: number; phi: number; degPerPx: number } | null>(null);
  const serifRef = useRef("Georgia");
  const frame = useRef(0);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  function projection(): GeoProjection {
    const { width, height } = sizeRef.current;
    const { lambda, phi, scale } = view.current;
    return geoOrthographic()
      .translate([width / 2, height / 2])
      .scale(Math.min(width, height) * 0.42 * scale)
      .rotate([lambda, phi]);
  }

  function paint() {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const { width, height } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(width * dpr));
    const nextHeight = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    const { lambda, phi, scale } = view.current;
    const projected = projection();
    const path = geoPath(projected, context);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.beginPath();
    path({ type: "Sphere" });
    context.fillStyle = "#F7F4ED";
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(0, 53, 107, 0.35)";
    context.stroke();
    if (geo.current.land) {
      context.beginPath();
      path(geo.current.land);
      context.fillStyle = "#D5E4F0";
      context.fill();
    }
    const radius = Math.min(width, height) * 0.42 * scale;
    const halfDiagonal = Math.hypot(width, height) / 2;
    const [borderLng, borderLat] = projectionCenter([lambda, phi]);
    const visible = (piece: CountryPiece) => isInView(piece.lng, piece.lat, piece.span, borderLng, borderLat, radius, halfDiagonal);
    const countryAlpha = fadeIn(scale, 1.2, 1.75);
    if (countryAlpha > 0.02 && geo.current.countries) {
      context.beginPath();
      let drewCountry = false;
      for (const piece of geo.current.countries) {
        if (!visible(piece)) continue;
        path(piece.geometry);
        drewCountry = true;
      }
      if (drewCountry) {
        context.lineWidth = 0.7;
        context.strokeStyle = `rgba(0, 53, 107, ${0.55 * countryAlpha})`;
        context.stroke();
      }
    }
    if (geo.current.europe) {
      const buckets: CountryPiece[][] = [[], [], [], [], []];
      for (const piece of geo.current.europe) {
        const alpha = europeBorderAlpha(piece.span, radius);
        if (alpha < 0.04 || !visible(piece)) continue;
        buckets[Math.min(4, Math.floor(alpha * 5))].push(piece);
      }
      context.lineJoin = "round";
      buckets.forEach((group, index) => {
        if (group.length === 0) return;
        const alpha = (index + 1) / 5;
        context.beginPath();
        for (const piece of group) path(piece.geometry);
        context.lineWidth = 0.85 + alpha * 0.45;
        context.strokeStyle = `rgba(0, 53, 107, ${0.32 + alpha * 0.5})`;
        context.stroke();
      });
    }
    const stateAlpha = fadeIn(scale, 2.05, 2.6);
    if (stateAlpha > 0.02 && geo.current.states) {
      context.beginPath();
      let drewState = false;
      for (const piece of geo.current.states) {
        if (!visible(piece)) continue;
        path(piece.geometry);
        drewState = true;
      }
      if (drewState) {
        context.lineWidth = 0.65;
        context.strokeStyle = `rgba(0, 53, 107, ${0.5 * stateAlpha})`;
        context.stroke();
      }
    }
    if (serifRef.current === "Georgia") {
      serifRef.current = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim() || "Georgia";
    }
    const serif = serifRef.current;
    const [labelCenterLng, labelCenterLat] = projectionCenter([lambda, phi]);
    context.textAlign = "center";
    const continentAlpha = 1 - fadeIn(scale, 1.05, 1.6);
    if (continentAlpha > 0.04) {
      context.font = `13px ${serif}, Georgia, serif`;
      context.fillStyle = `rgba(0, 53, 107, ${0.42 * continentAlpha})`;
      for (const continent of CONTINENTS) {
        if (!isFacing(continent.lng, continent.lat, labelCenterLng, labelCenterLat)) continue;
        const point = projected([continent.lng, continent.lat]);
        if (!point) continue;
        context.fillText(continent.name, point[0], point[1]);
      }
    }
    const countryLabelAlpha = fadeIn(scale, 1.15, 1.65) * (1 - fadeIn(scale, 2.15, 2.7));
    const placedLabels: { x: number; y: number; w: number; h: number }[] = [];
    const drawCountryName = (name: string, point: [number, number], alpha: number, size: number) => {
      context.font = `${size}px ${serif}, Georgia, serif`;
      const widthPx = context.measureText(name).width;
      const box = { x: point[0], y: point[1], w: widthPx + 10, h: size + 6 };
      if (placedLabels.some((item) => Math.abs(item.x - box.x) < (item.w + box.w) / 2 && Math.abs(item.y - box.y) < (item.h + box.h) / 2)) return;
      placedLabels.push(box);
      context.fillStyle = `rgba(0, 53, 107, ${0.78 * alpha})`;
      context.fillText(name, point[0], point[1]);
    };
    if (geo.current.countryLabels) {
      if (countryLabelAlpha > 0.04) {
        for (const country of geo.current.countryLabels) {
          if (country.europeSpan != null) continue;
          if (!isFacing(country.lng, country.lat, labelCenterLng, labelCenterLat)) continue;
          const point = projected([country.lng, country.lat]);
          if (!point) continue;
          const name = country.name === "United States of America" ? "United States" : country.name;
          drawCountryName(name, point, countryLabelAlpha, 12);
        }
      }
      const europeLabels = geo.current.countryLabels.filter((country) => country.europeSpan != null).sort((a, b) => (b.europeSpan ?? 0) - (a.europeSpan ?? 0));
      for (const country of europeLabels) {
        const alpha = europeLabelAlpha(country.europeSpan ?? 0, radius);
        if (alpha < 0.04 || !isFacing(country.lng, country.lat, labelCenterLng, labelCenterLat)) continue;
        const point = projected([country.lng, country.lat]);
        if (!point) continue;
        drawCountryName(country.name, point, alpha, 12 + alpha * 4);
      }
    }
    const stateLabelAlpha = fadeIn(scale, 1.95, 2.45) * (1 - fadeIn(scale, 3.35, 3.95));
    if (stateLabelAlpha > 0.04 && geo.current.stateLabels) {
      context.font = `11px ${serif}, Georgia, serif`;
      context.fillStyle = `rgba(0, 53, 107, ${0.55 * stateLabelAlpha})`;
      const placed: { x: number; y: number }[] = [];
      for (const state of geo.current.stateLabels) {
        if (!isFacing(state.lng, state.lat, labelCenterLng, labelCenterLat)) continue;
        const point = projected([state.lng, state.lat]);
        if (!point) continue;
        if (placed.some((item) => (item.x - point[0]) ** 2 + (item.y - point[1]) ** 2 < 26 ** 2)) continue;
        placed.push({ x: point[0], y: point[1] });
        const name = state.name === "District of Columbia" ? "D.C." : state.name;
        context.fillText(name, point[0], point[1]);
      }
    }
    const [centerLng, centerLat] = projectionCenter([lambda, phi]);
    root.querySelectorAll<HTMLElement>("[data-lng]").forEach((element) => {
      const lng = Number(element.dataset.lng);
      const lat = Number(element.dataset.lat);
      if (!isFacing(lng, lat, centerLng, centerLat)) {
        element.style.visibility = "hidden";
        return;
      }
      const point = projected([lng, lat]);
      if (!point) {
        element.style.visibility = "hidden";
        return;
      }
      element.style.visibility = "visible";
      element.style.left = `${point[0]}px`;
      element.style.top = `${point[1]}px`;
    });
  }

  function scheduleDraw() {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      paint();
    });
  }

  function zoomBy(factor: number) {
    view.current.scale = clampScale(view.current.scale * factor);
    scheduleDraw();
  }

  function nudge(dLambda: number, dPhi: number) {
    view.current.lambda += dLambda;
    view.current.phi = clampPhi(view.current.phi + dPhi);
    scheduleDraw();
  }

  function resetView() {
    view.current.lambda = -12;
    view.current.phi = -22;
    view.current.scale = 1;
    scheduleDraw();
  }

  useEffect(() => {
    let cancelled = false;
    function loadGeo(url: string, key: "land") {
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(url);
          return response.json();
        })
        .then((data: GeoPermissibleObjects) => {
          if (cancelled) return;
          geo.current[key] = data;
          scheduleDraw();
        })
        .catch(() => {
          if (cancelled) return;
          geo.current[key] = { type: "FeatureCollection", features: [] };
        });
    }
    function bindEuropeSpans() {
      const pieces = geo.current.europe;
      const labels = geo.current.countryLabels;
      if (!pieces || !labels) return;
      const european = pieces.filter((piece) => piece.europe);
      for (const label of labels) {
        label.europeSpan = largestNearbySpan(label, european);
      }
    }
    loadGeo("/geo/land-110m.json", "land");
    fetch("/geo/countries-50m.json")
      .then((response) => {
        if (!response.ok) throw new Error("countries");
        return response.json();
      })
      .then((data: { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }) => {
        if (cancelled) return;
        const pieces = countryPieces(data.features);
        geo.current.europe = pieces.filter((piece) => piece.europe);
        geo.current.countries = pieces.filter((piece) => !piece.europe);
        bindEuropeSpans();
        scheduleDraw();
      })
      .catch(() => {
        if (cancelled) return;
        geo.current.europe = [];
        geo.current.countries = [];
      });
    fetch("/geo/us-states-50m.json")
      .then((response) => {
        if (!response.ok) throw new Error("states");
        return response.json();
      })
      .then((data: { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }) => {
        if (cancelled) return;
        geo.current.states = countryPieces(data.features);
        scheduleDraw();
      })
      .catch(() => {
        if (cancelled) return;
        geo.current.states = [];
      });
    fetch("/geo/us-state-labels.json")
      .then((response) => {
        if (!response.ok) throw new Error("state labels");
        return response.json();
      })
      .then((data: PlaceLabel[]) => {
        if (cancelled) return;
        geo.current.stateLabels = data;
        scheduleDraw();
      })
      .catch(() => {
        if (!cancelled) geo.current.stateLabels = [];
      });
    fetch("/geo/country-labels.json")
      .then((response) => {
        if (!response.ok) throw new Error("country labels");
        return response.json();
      })
      .then((data: PlaceLabel[]) => {
        if (cancelled) return;
        geo.current.countryLabels = data.map((label) => ({ ...label, europeSpan: null }));
        bindEuropeSpans();
        scheduleDraw();
      })
      .catch(() => {
        if (!cancelled) geo.current.countryLabels = [];
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const observer = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      scheduleDraw();
    });
    observer.observe(parent);
    const rect = parent.getBoundingClientRect();
    sizeRef.current = { width: rect.width, height: rect.height };
    scheduleDraw();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      if (!root.contains(event.target as Node)) return;
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      view.current.scale = clampScale(view.current.scale * Math.exp(-delta * 0.0014));
      scheduleDraw();
    };
    let gestureBase = view.current.scale;
    const onGestureStart = (event: Event) => {
      if (!root.contains(event.target as Node)) return;
      event.preventDefault();
      gestureBase = view.current.scale;
    };
    const onGestureChange = (event: Event) => {
      if (!root.contains(event.target as Node)) return;
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale;
      if (!scale) return;
      view.current.scale = clampScale(gestureBase * scale);
      scheduleDraw();
    };
    const listen = { passive: false, capture: true } as AddEventListenerOptions;
    window.addEventListener("wheel", onWheel, listen);
    window.addEventListener("gesturestart", onGestureStart, listen);
    window.addEventListener("gesturechange", onGestureChange, listen);
    return () => {
      window.removeEventListener("wheel", onWheel, listen);
      window.removeEventListener("gesturestart", onGestureStart, listen);
      window.removeEventListener("gesturechange", onGestureChange, listen);
    };
  }, []);

  useEffect(() => {
    scheduleDraw();
  }, [pins, selectedKey]);

  return (
    <div
      ref={rootRef}
      className="globe-canvas"
      tabIndex={0}
      aria-label="Globe. Arrow keys rotate. Plus and minus zoom."
      onKeyDown={(event) => {
        const step = event.shiftKey ? 18 : 8;
        if (event.key === "ArrowLeft") nudge(step, 0);
        else if (event.key === "ArrowRight") nudge(-step, 0);
        else if (event.key === "ArrowUp") nudge(0, step);
        else if (event.key === "ArrowDown") nudge(0, -step);
        else if (event.key === "+" || event.key === "=") zoomBy(1.12);
        else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.12);
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const { width, height } = sizeRef.current;
        const radius = Math.max(1, Math.min(width, height) * 0.42 * view.current.scale);
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          lambda: view.current.lambda,
          phi: view.current.phi,
          degPerPx: 180 / (Math.PI * radius),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        view.current.lambda = drag.current.lambda + dx * drag.current.degPerPx;
        view.current.phi = clampPhi(drag.current.phi - dy * drag.current.degPerPx);
        scheduleDraw();
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }} />
      <div className="globe-nav" role="group" aria-label="Move the globe" onPointerDown={(event) => event.stopPropagation()}>
        <span className="globe-nav-label">Zoom</span>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.18)}>
          −
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.18)}>
          +
        </button>
        <span className="globe-nav-gap" aria-hidden="true" />
        <span className="globe-nav-label">Turn</span>
        <button type="button" aria-label="Turn left" onClick={() => nudge(22, 0)}>
          ←
        </button>
        <button type="button" aria-label="Turn right" onClick={() => nudge(-22, 0)}>
          →
        </button>
        <span className="globe-nav-gap" aria-hidden="true" />
        <button type="button" className="globe-nav-reset" onClick={resetView}>
          Reset
        </button>
      </div>
      {pins.map((pin) => (
        <PinButton
          key={pin.key}
          pin={pin}
          selected={selectedKey === pin.key}
          onSelect={onSelect}
          style={{ visibility: "hidden" }}
        />
      ))}
    </div>
  );
}
