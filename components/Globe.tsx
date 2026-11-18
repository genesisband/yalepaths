"use client";

import dynamic from "next/dynamic";
import type { Pin } from "@/lib/experiences";
import type { Experience } from "@/lib/types";

const OsmMap = dynamic(() => import("@/components/OsmMap").then((mod) => mod.OsmMap), { ssr: false });

export function Globe({
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
  return (
    <div className="globe-pane" data-testid="globe-pane">
      <OsmMap pins={pins} records={records} selectedKey={selectedKey} onSelect={onSelect} />
    </div>
  );
}
