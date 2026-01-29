import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import {
  Button,
  Badge,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "@vault/ui";
import { Plus, Pencil, Eye, ExternalLink } from "lucide-react";
import {
  getAdminEventEditUrl,
  getAdminEventNewMarketUrl,
  getAdminMarketUrl,
  getMarketUrl,
} from "@/lib/urls";
import { PublishToggle } from "@/components/admin/publish-toggle";

// Force dynamic rendering - requires database access
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper to parse outcomes
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      tags: true,
      markets: {
        select: {
          id: true,
          question: true,
          outcomes: true,
          status: true,
          isPublished: true,
          pool0: true,
          pool1: true,
          seed0: true,
          seed1: true,
          _count: {
            select: {
              bets: { where: { status: "CONFIRMED" } },
              positions: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) {
    notFound();
  }

  // Calculate totals (convert Decimals to numbers)
  const totalBets = event.markets.reduce((sum, m) => sum + m._count.bets, 0);
  const totalVolume = event.markets.reduce(
    (sum, m) => sum + Number(m.pool0) + Number(m.pool1),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground">
            {event.description || `/${event.slug}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={getAdminEventEditUrl(event.id)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Event
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={getMarketUrl(event.slug)} target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public
            </Link>
          </Button>
          <Button asChild>
            <Link href={getAdminEventNewMarketUrl(event.id)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Market
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Markets list */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Markets ({event.markets.length})
                </h2>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Question
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Outcomes
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Published
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Pool
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Bets
                      </th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.markets.map((market) => {
                      const outcomes = parseOutcomes(market.outcomes);
                      const pool = Number(market.seed0) + Number(market.seed1) + Number(market.pool0) + Number(market.pool1);

                      return (
                        <tr
                          key={market.id}
                          className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <td className="p-4">
                            <p className="font-medium text-sm max-w-xs truncate">
                              {market.question}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">
                                {outcomes[0]}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {outcomes[1]}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4">
                            <PublishToggle
                              id={market.id}
                              type="market"
                              isPublished={market.isPublished}
                            />
                          </td>
                          <td className="p-4">
                            <Badge
                              variant={
                                market.status === "OPEN"
                                  ? "success"
                                  : market.status === "SETTLED"
                                    ? "default"
                                    : market.status === "RESOLVED"
                                      ? "default"
                                      : "secondary"
                              }
                            >
                              {market.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-right font-mono text-sm">
                            ${pool.toLocaleString()}
                          </td>
                          <td className="p-4 text-right">
                            {market._count.bets}
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={getAdminMarketUrl(market.id)}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {event.markets.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-8 text-center text-muted-foreground"
                        >
                          No markets yet. Add your first market!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Event info */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h3 className="text-sm font-semibold">Event Details</h3>
            </GlassCardHeader>
            <GlassCardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Published</span>
                <PublishToggle
                  id={event.id}
                  type="event"
                  isPublished={event.isPublished}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <Badge variant="secondary">{event.category}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={event.active ? "success" : "destructive"}>
                  {event.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Closed</span>
                <span>{event.closed ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Time</span>
                <span>
                  {event.startTime
                    ? format(new Date(event.startTime), "MMM d, yyyy HH:mm")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">End Time</span>
                <span>
                  {event.endTime
                    ? format(new Date(event.endTime), "MMM d, yyyy HH:mm")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>
                  {format(new Date(event.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Tags */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h3 className="text-sm font-semibold">Tags</h3>
            </GlassCardHeader>
            <GlassCardContent>
              {event.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Stats */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h3 className="text-sm font-semibold">Statistics</h3>
            </GlassCardHeader>
            <GlassCardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Markets</span>
                <span className="font-semibold">{event.markets.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Bets</span>
                <span className="font-semibold">{totalBets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Volume</span>
                <span className="font-semibold font-mono">
                  ${totalVolume.toLocaleString()}
                </span>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Media */}
          {(event.bannerUrl || event.logoUrl) && (
            <GlassCard variant="solid">
              <GlassCardHeader>
                <h3 className="text-sm font-semibold">Media</h3>
              </GlassCardHeader>
              <GlassCardContent className="space-y-3">
                {event.bannerUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Banner</p>
                    <img
                      src={event.bannerUrl}
                      alt="Banner"
                      className="w-full h-20 object-cover rounded-md"
                    />
                  </div>
                )}
                {event.logoUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Logo</p>
                    <img
                      src={event.logoUrl}
                      alt="Logo"
                      className="w-12 h-12 object-cover rounded-md"
                    />
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
