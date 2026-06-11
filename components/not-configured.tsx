import { org } from "@/lib/config";

export function NotConfigured() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {org.appName}
        </p>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">
          Sharing is not configured
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Public links require <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          on the server. Add it to the environment and reload.
        </p>
      </div>
    </div>
  );
}
