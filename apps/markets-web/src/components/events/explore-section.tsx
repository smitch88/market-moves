"use client";

import { EventCardCompact } from "./event-card-compact";
import type { Event } from "@vault/database";

// Event type that accepts both Date and string for date fields
type SerializedEvent = Omit<Event, 'createdAt' | 'updatedAt' | 'startTime' | 'endTime'> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  startTime: Date | string | null;
  endTime: Date | string | null;
};

interface KOLCreator {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}

interface EventWithAggregations extends SerializedEvent {
  _count: { markets: number };
  _aggregations: {
    totalVolume: number;
    totalBets: number;
    totalVerifications?: number;
    earliestClose?: string | null;
  };
  createdByKol?: KOLCreator | null;
}

interface MarketSectionProps {
  title: string;
  events: EventWithAggregations[];
}

export function MarketSection({ title, events }: MarketSectionProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>

      {/* Events grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {events.map((event, index) => (
          <EventCardCompact key={event.id} event={event} index={index} />
        ))}
      </div>
    </div>
  );
}

// Keep ExploreSection as an alias for backwards compatibility
export function ExploreSection({ events }: { events: EventWithAggregations[] }) {
  return <MarketSection title="Explore More" events={events} />;
}
