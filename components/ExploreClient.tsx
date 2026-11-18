"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe } from "@/components/Globe";
import { ResultIndex } from "@/components/ResultIndex";
import {
  catalogYears,
  currentMonth,
  filterExperiences,
  matchesMapSelection,
  memberCatalog,
  pinsFrom,
} from "@/lib/experiences";
import { EXPERIENCE_TYPES, type Experience, type ExperienceType } from "@/lib/types";

export function ExploreClient({ experiences }: { experiences: Experience[] }) {
  const now = useMemo(() => currentMonth(), []);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  const catalog = useMemo(() => memberCatalog(experiences), [experiences]);
  const years = useMemo(() => catalogYears(catalog, now), [catalog, now]);
  const filtered = useMemo(
    () =>
      filterExperiences(
        catalog,
        {
          query,
          type: (type || null) as ExperienceType | null,
          year: year ? Number(year) : null,
        },
        now,
      ),
    [catalog, query, type, year, now],
  );
  const pins = useMemo(() => pinsFrom(filtered), [filtered]);
  const listed = useMemo(
    () => (selected ? filtered.filter((record) => matchesMapSelection(record, selected)) : filtered),
    [filtered, selected],
  );

  useEffect(() => {
    if (!selected) return;
    if (selected.startsWith("org:")) {
      if (!filtered.some((record) => matchesMapSelection(record, selected))) setSelected(null);
      return;
    }
    if (!pins.some((pin) => pin.key === selected)) setSelected(null);
  }, [filtered, pins, selected]);

  return (
    <div className={mobileView === "map" ? "explore show-map" : "explore show-list"}>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="City, organization, or lab"
          aria-label="Search by city, organization, or lab"
          data-testid="search"
        />
        <label className="field">
          <span>Year</span>
          <select value={year} onChange={(event) => setYear(event.target.value)} data-testid="year-filter" aria-label="Year">
            <option value="">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)} data-testid="type-filter" aria-label="Experience type">
            <option value="">All types</option>
            {EXPERIENCE_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="view-switch" role="group" aria-label="Map or list">
        <button type="button" aria-pressed={mobileView === "map"} data-testid="view-map" onClick={() => setMobileView("map")}>
          Map
        </button>
        <button type="button" aria-pressed={mobileView === "list"} data-testid="view-list" onClick={() => setMobileView("list")}>
          List
        </button>
      </div>
      <div className="explore-body">
        <Globe pins={pins} records={filtered} selectedKey={selected} onSelect={setSelected} />
        <ResultIndex records={listed} selectedKey={selected} now={now} onClear={() => setSelected(null)} />
      </div>
    </div>
  );
}
