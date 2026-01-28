import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { EventForm } from "@/components/admin/event-form";

interface PageProps {
  params: Promise<{ id: string }>;
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Edit Event</h1>
        <p className="text-muted-foreground">{event.title}</p>
      </div>

      <EventForm event={event} />
    </div>
  );
}
