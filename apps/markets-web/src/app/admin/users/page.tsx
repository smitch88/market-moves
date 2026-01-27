import { prisma } from "@vault/database";
import { Badge, Button, GlassCard, GlassCardContent } from "@vault/ui";
import { format } from "date-fns";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          bets: { where: { status: "CONFIRMED" } },
          positions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage platform users</p>
      </div>

      <GlassCard>
        <GlassCardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Balance
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Bets
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Positions
                  </th>
                  <th className="text-right p-4 font-medium text-muted-foreground">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">
                          {user.name || user.handle || "Anonymous"}
                        </p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        )}
                        {user.handle && (
                          <p className="text-sm text-muted-foreground">@{user.handle}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-mono text-[#df2421]">
                      ${user.balance.toLocaleString()}
                    </td>
                    <td className="p-4 text-right">{user._count.bets}</td>
                    <td className="p-4 text-right">{user._count.positions}</td>
                    <td className="p-4 text-right text-sm text-muted-foreground">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No users yet
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
