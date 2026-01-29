import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import { Button, Badge, GlassCard, GlassCardContent } from "@vault/ui";
import { Plus, Eye, Pencil } from "lucide-react";
import { getAdminEventUrl, getAdminEventEditUrl } from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      active: true,
      closed: true,
      isPublished: true,
      startTime: true,
      createdAt: true,
      tags: true,
      markets: {
        select: {
          id: true,
          status: true,
          isPublished: true,
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

  // Helper function to get event status
  const getEventStatus = (event: typeof events[0]) => {
    const totalBets = event.markets.reduce((sum, m) => sum + m._count.bets, 0);
    const marketStatuses = event.markets.map((m) => m.status);
    const hasOpen = marketStatuses.includes("OPEN");
    const allSettled = marketStatuses.every((s) => s === "SETTLED");
    const allDraft = marketStatuses.every((s) => s === "DRAFT");

    let status: "active" | "closed" | "draft" | "settled" = "draft";
    if (event.closed || allSettled) {
      status = "settled";
    } else if (!event.active) {
      status = "closed";
    } else if (hasOpen) {
      status = "active";
    } else if (allDraft) {
      status = "draft";
    }

    return { status, totalBets };
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage prediction events and their markets
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      <GlassCard variant="solid">
        <GlassCardContent className="p-0">
          {/* Mobile Card View */}
          <div className="sm:hidden p-4 space-y-3">
            {events.map((event) => {
              const { status, totalBets } = getEventStatus(event);
              return (
                <Link
                  key={event.id}
                  href={getAdminEventUrl(event.id)}
                  className="block p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{event.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {event.description || event.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          status === "active"
                            ? "success"
                            : status === "settled"
                              ? "default"
                              : status === "closed"
                                ? "destructive"
                                : "secondary"
                        }
                        className="text-xs"
                      >
                        {status === "active"
                          ? "Active"
                          : status === "settled"
                            ? "Settled"
                            : status === "closed"
                              ? "Inactive"
                              : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">{event.category}</Badge>
                    {event.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag.id} variant="outline" className="text-xs">
                        {tag.label}
                      </Badge>
                    ))}
                    {event.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">+{event.tags.length - 2}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Markets</p>
                      <p className="text-sm font-medium">{event._count.markets}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bets</p>
                      <p className="text-sm font-medium">{totalBets}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Published</p>
                      <p className="text-sm font-medium">{event.isPublished ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
            {events.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">
                No events yet. Create your first event!
              </p>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
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
                    Published
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
                  const { status: eventStatus, totalBets } = getEventStatus(event);

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
                        <PublishToggle
                          id={event.id}
                          type="event"
                          isPublished={event.isPublished}
                        />
                      </td>
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
                      colSpan={9}
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
