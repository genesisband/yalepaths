"use client";

import Link from "next/link";
import { groupForIndex, type Filterable } from "@/lib/experiences";
import { formatSpan } from "@/lib/format";
import { typeLabel, type MonthPoint } from "@/lib/types";
import type { Experience } from "@/lib/types";

export function ResultIndex({
  records,
  selectedKey,
  now,
  onClear,
}: {
  records: Experience[];
  selectedKey: string | null;
  now: MonthPoint;
  onClear: () => void;
}) {
  const groups = groupForIndex(records as (Experience & Filterable)[]);
  const noun = records.length === 1 ? "experience" : "experiences";
  return (
    <section className="index-pane" aria-label="Experiences" data-testid="result-list">
      <div className="index-head">
        <p>
          {records.length} {noun}
        </p>
        {selectedKey ? (
          <button type="button" className="text-button" onClick={onClear}>
            Show every city
          </button>
        ) : null}
      </div>
      {groups.length === 0 ? <p className="empty">No shared experiences match.</p> : null}
      {groups.map((group) => {
        const duplicate = groups.filter((item) => item.city === group.city).length > 1;
        const heading = duplicate && group.region ? `${group.city}, ${group.region}` : group.city;
        return (
          <div key={group.key}>
            <h2 className={selectedKey === group.key ? "city-heading is-selected" : "city-heading"}>{heading}</h2>
            <ul className="result-list">
              {group.rows.map((row) => {
                const span = formatSpan(row, now);
                return (
                  <li key={row.id}>
                    <Link className="result-row" href={`/members/${row.owner_id}`} data-testid="result-row">
                      <span className="org">{row.organization}</span>
                      <span className="meta">
                        {typeLabel(row.experience_type)}
                        {row.profile?.display_name ? ` · ${row.profile.display_name}` : ""}
                      </span>
                      {row.lab_name ? <span className="lab">{row.lab_name}</span> : null}
                      <span className="dates">
                        {span.text}
                        {span.upcoming ? " · Upcoming" : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
