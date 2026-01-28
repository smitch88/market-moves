import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import { Button, Badge, GlassCard, GlassCardContent } from "@vault/ui";
import { Plus, Eye, Pencil } from "lucide-react";
import { getAdminEventUrl, getAdminEventEditUrl } from "@/lib/urls";

export default async function AdminEventsPage() {
  const events = await prisma.event.findMany({
    include: {
      tags: true,
      markets: {
        select: {
          id: true,
          status: true,
          _count: {
            select: { bets: { where: { status: "CONFIRMED" } } },
          },
        },
      },
      _count: {
        select: { markets: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Manage prediction events and their markets
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      <GlassCard>
        <GlassCardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Event
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Tags
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Markets
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Total Bets
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Start Time
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const totalBets = event.markets.reduce(
                    (sum, m) => sum + m._count.bets,
                    0
                  );
                  // Determine overall event status based on markets
                  const marketStatuses = event.markets.map((m) => m.status);
                  const hasOpen = marketStatuses.includes("OPEN");
                  const allSettled = marketStatuses.every(
                    (s) => s === "SETTLED"
                  );
                  const allDraft = marketStatuses.every((s) => s === "DRAFT");

                  let eventStatus: "active" | "closed" | "draft" | "settled" =
                    "draft";
                  if (event.closed || allSettled) {
                    eventStatus = "settled";
                  } else if (!event.active) {
                    eventStatus = "closed";
                  } else if (hasOpen) {
                    eventStatus = "active";
                  } else if (allDraft) {
                    eventStatus = "draft";
                  }

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {event.description || event.slug}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{event.category}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {event.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag.label}
                            </Badge>
                          ))}
                          {event.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{event.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{event._count.markets}</td>
                      <td className="p-4">{totalBets}</td>
                      <td className="p-4">
                        <Badge
                          variant={
                            eventStatus === "active"
                              ? "success"
                              : eventStatus === "settled"
                                ? "default"
                                : eventStatus === "closed"
                                  ? "destructive"
                                  : "secondary"
                          }
                        >
                          {eventStatus === "active"
                            ? "Active"
                            : eventStatus === "settled"
                              ? "Settled"
                              : eventStatus === "closed"
                                ? "Inactive"
                                : "Draft"}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {event.startTime
                          ? format(new Date(event.startTime), "MMM d, yyyy")
                          : "-"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={getAdminEventUrl(event.id)}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={getAdminEventEditUrl(event.id)}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {events.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No events yet. Create your first event!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
