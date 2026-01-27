import { GlassCard, GlassCardContent, GlassCardHeader, Badge } from "@vault/ui";

export default function AdminSettingsPage() {
  const adminTwitterIds = process.env.ADMIN_TWITTER_IDS?.split(",") || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Platform configuration</p>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Admin Allowlist</h2>
          <p className="text-sm text-muted-foreground">
            Twitter IDs that automatically get ADMIN role on signup
          </p>
        </GlassCardHeader>
        <GlassCardContent>
          {adminTwitterIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {adminTwitterIds.map((id) => (
                <Badge key={id} variant="secondary" className="font-mono">
                  {id.trim()}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No admin Twitter IDs configured. Set ADMIN_TWITTER_IDS environment variable.
            </p>
          )}
        </GlassCardContent>
      </GlassCard>

      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Environment</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Node Environment</span>
            <Badge variant="secondary">{process.env.NODE_ENV}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Privy Configured</span>
            <Badge variant={process.env.PRIVY_APP_ID ? "success" : "destructive"}>
              {process.env.PRIVY_APP_ID ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">RapidAPI Configured</span>
            <Badge variant={process.env.RAPID_API_KEY ? "success" : "destructive"}>
              {process.env.RAPID_API_KEY ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database Connected</span>
            <Badge variant={process.env.DATABASE_URL ? "success" : "destructive"}>
              {process.env.DATABASE_URL ? "Yes" : "No"}
            </Badge>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
