import Link from "next/link";
import { prisma } from "@vault/database";
import { format } from "date-fns";
import { Button, Badge, GlassCard, GlassCardContent, GlassCardHeader } from "@vault/ui";
import { Plus } from "lucide-react";

export default async function AdminMarketsPage() {
  const markets = await prisma.market.findMany({
    include: {
      outcomes: true,
      _count: {
        select: { bets: { where: { status: "CONFIRMED" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-muted-foreground">Manage prediction markets</p>
        </div>
        <Button asChild>
          <Link href="/admin/markets/new">
            <Plus className="h-4 w-4 mr-2" />
            New Market
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
                    Market
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Bets
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Closes
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr
                    key={market.id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{market.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {market.question}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary">{market.category}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          market.status === "OPEN"
                            ? "success"
                            : market.status === "RESOLVED"
                            ? "default"
                            : market.status === "SETTLED"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {market.status}
                      </Badge>
                    </td>
                    <td className="p-4">{market._count.bets}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {market.closesAt
                        ? format(new Date(market.closesAt), "MMM d, yyyy")
                        : "-"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/markets/${market.id}`}>View</Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/markets/${market.id}/edit`}>Edit</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {markets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No markets yet. Create your first market!
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
