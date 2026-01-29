import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { EventForm } from "@/components/admin/event-form";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper to serialize event for client components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeEvent(event: any) {
  return {
    ...event,
    startTime: event.startTime?.toISOString() ?? null,
    endTime: event.endTime?.toISOString() ?? null,
    createdAt: event.createdAt?.toISOString() ?? null,
    updatedAt: event.updatedAt?.toISOString() ?? null,
  };
}

export default async function AdminEventEditPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      tags: true,
    },
  });

  if (!event) {
    notFound();
  }

  // Serialize event for client component
  const serializedEvent = serializeEvent(event);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Event</h1>
        <p className="text-muted-foreground">{event.title}</p>
      </div>

      <EventForm event={serializedEvent} />
    </div>
  );
}
