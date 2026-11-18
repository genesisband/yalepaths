"use client";

import { useEffect, useId, useState } from "react";
import { cityLabel, searchCities, type CityOption } from "@/lib/cities";
import { mapboxToken } from "@/lib/public-config";

async function mapboxCities(query: string, token: string): Promise<CityOption[]> {
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("types", "place");
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  if (!response.ok) return [];
  const body = (await response.json()) as {
    features?: { text?: string; center?: [number, number]; context?: { id: string; text: string }[] }[];
  };
  return (body.features ?? []).flatMap((feature) => {
    if (!feature.text || !feature.center) return [];
    const context = feature.context ?? [];
    const region = context.find((item) => item.id.startsWith("region"))?.text;
    const country = context.find((item) => item.id.startsWith("country"))?.text;
    const label = [region, country].filter(Boolean).join(", ");
    return [{ city: feature.text, region: label, lat: feature.center[1], lng: feature.center[0] }];
  });
}

export function CityPicker({ initial }: { initial?: CityOption | null }) {
  const listId = useId();
  const [query, setQuery] = useState(initial ? cityLabel(initial) : "");
  const [selected, setSelected] = useState<CityOption | null>(initial ?? null);
  const [options, setOptions] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const local = searchCities(query);
    setOptions(local);
    const token = mapboxToken();
    if (!token || query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      mapboxCities(query, token)
        .then((remote) => {
          const merged = [...remote];
          for (const city of local) {
            const key = cityLabel(city).toLowerCase();
            if (!merged.some((item) => cityLabel(item).toLowerCase() === key)) merged.push(city);
          }
          setOptions(merged.slice(0, 8));
        })
        .catch(() => setOptions(local));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function choose(city: CityOption) {
    setSelected(city);
    setQuery(cityLabel(city));
    setOpen(false);
  }

  return (
    <div>
      <label className="block" htmlFor={`${listId}-input`}>
        <span className="label">City</span>
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder="Start typing a city"
          data-testid="city-input"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open || options.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(options.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            } else if (event.key === "Enter" && options[active]) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </label>
      <input type="hidden" name="city" value={selected?.city ?? ""} />
      <input type="hidden" name="region" value={selected?.region ?? ""} />
      <input type="hidden" name="lat" value={selected?.lat ?? ""} />
      <input type="hidden" name="lng" value={selected?.lng ?? ""} />
      {open && options.length > 0 ? (
        <ul role="listbox" id={listId} className="suggestions">
          {options.map((city, index) => (
            <li key={`${city.city}-${city.region}-${city.lat}`}>
              <button type="button" role="option" aria-selected={index === active} onMouseDown={() => choose(city)}>
                {cityLabel(city)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
