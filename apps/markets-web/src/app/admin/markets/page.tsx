import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import { Button, Badge, GlassCard, GlassCardContent } from "@vault/ui";
import { Plus } from "lucide-react";
import { getAdminMarketUrl, getAdminMarketEditUrl } from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

// Helper to parse outcomes
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

export default async function AdminMarketsPage() {
  // Fetch events with their markets
  const events = await prisma.event.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      category: true,
      isPublished: true,
      markets: {
        select: {
          id: true,
          question: true,
          outcomes: true,
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events & Markets</h1>
          <p className="text-muted-foreground">Manage prediction events and their markets</p>
        </div>
        <Button asChild>
          <Link href="/admin/markets/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      <GlassCard variant="solid">
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
                    Markets
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Published
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Bets
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
                  const primaryMarket = event.markets[0];
                  const outcomes = primaryMarket
                    ? parseOutcomes(primaryMarket.outcomes)
                    : ["Yes", "No"];

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {primaryMarket?.question || event.description}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{event.category}</Badge>
                      </td>
                      <td className="p-4">{event._count.markets}</td>
                      <td className="p-4">
                        <PublishToggle
                          id={event.id}
                          type="event"
                          isPublished={event.isPublished}
                        />
                      </td>
                      <td className="p-4">
                        {primaryMarket && (
                          <Badge
                            variant={
                              primaryMarket.status === "OPEN"
                                ? "success"
                                : primaryMarket.status === "RESOLVED"
                                ? "default"
                                : primaryMarket.status === "SETTLED"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {primaryMarket.status}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">{totalBets}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {primaryMarket && (
                            <>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={getAdminMarketUrl(primaryMarket.id)}>
                                  View
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={getAdminMarketEditUrl(primaryMarket.id)}>
                                  Edit
                                </Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
