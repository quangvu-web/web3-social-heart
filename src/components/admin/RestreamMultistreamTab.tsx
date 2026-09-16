import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RadioTower, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getRestreamSetupStatus, type RestreamSetupStatus } from '@/modules/live/restreamService';

interface RestreamLog {
  id: string;
  live_session_id: string | null;
  action: string;
  method: string | null;
  endpoint: string | null;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface RestreamDestination {
  id: string;
  live_session_id: string;
  platform: string;
  display_name: string | null;
  status: string;
  signal_status: string;
  last_error: string | null;
}

async function invokeAdminLogs() {
  const { data, error } = await supabase.functions.invoke('restream-api', {
    body: { action: 'admin_logs', payload: { limit: 100 } },
  });
  if (error) throw error;
  if (data?.success === false) throw new Error(data.error || 'Unable to load Restream logs');
  return data as { logs: RestreamLog[]; destinations: RestreamDestination[] };
}

export default function RestreamMultistreamTab() {
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState<RestreamSetupStatus | null>(null);
  const [logs, setLogs] = useState<RestreamLog[]>([]);
  const [destinations, setDestinations] = useState<RestreamDestination[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const setupStatus = await getRestreamSetupStatus();
      setSetup(setupStatus);
      if (setupStatus.database.ok) {
        const data = await invokeAdminLogs();
        setLogs(data.logs || []);
        setDestinations(data.destinations || []);
      } else {
        setLogs([]);
        setDestinations([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cannot load Restream logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <RadioTower className="h-5 w-5 text-emerald-600" />
            Restream Multistream
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh setup status
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>External multistream only. FUN.RICH live, replay, archive, feed, and permissions remain the source of truth.</p>
          <div className="rounded-md border bg-muted/40 p-3">
            Required env: <code>RESTREAM_CLIENT_ID</code>, <code>RESTREAM_CLIENT_SECRET</code>, <code>RESTREAM_REDIRECT_URI</code>, <code>RESTREAM_TOKEN_ENCRYPTION_SECRET</code>. Agora egress needs <code>AGORA_RTMP_EGRESS_API_URL</code> or <code>AGORA_RTMP_CONVERTER_PATH</code>.
          </div>
          {setup && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={setup.function_reachable ? 'default' : 'destructive'}>Function {setup.function_reachable ? 'reachable' : 'unreachable'}</Badge>
                <Badge variant={setup.database.ok ? 'default' : 'destructive'}>Database {setup.database.ok ? 'ready' : 'needs migration'}</Badge>
                <Badge variant={setup.env.ok ? 'default' : 'destructive'}>Env {setup.env.ok ? 'ready' : 'missing'}</Badge>
                <Badge variant={setup.env.agora_egress_configured ? 'default' : 'secondary'}>Agora egress {setup.env.agora_egress_configured ? 'configured' : 'not configured'}</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded bg-muted/40 p-2">
                  <div className="mb-1 font-medium text-foreground">Required Restream env</div>
                  <ul className="space-y-1">
                    {[
                      { name: 'RESTREAM_CLIENT_ID', ok: setup.env.restream_client_id },
                      { name: 'RESTREAM_CLIENT_SECRET', ok: setup.env.restream_client_secret },
                      { name: 'RESTREAM_REDIRECT_URI', ok: setup.env.restream_redirect_uri },
                      { name: 'RESTREAM_TOKEN_ENCRYPTION_SECRET', ok: setup.env.restream_token_encryption_secret },
                    ].map(({ name, ok }) => (
                      <li key={name} className="flex items-center justify-between gap-2">
                        <code>{name}</code>
                        <Badge variant={ok ? 'default' : 'destructive'}>{ok ? 'set' : 'missing'}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="mb-1 font-medium text-foreground">Redirect URI</div>
                  <p className="break-all"><code>{setup.env.redirect_uri || setup.env.expected_callback_url || 'Not configured'}</code></p>
                  <p className="mt-1 text-xs">Copy exact URI này vào Restream Developer App.</p>
                </div>
              </div>
              {!setup.database.ok && (
                <div className="rounded bg-destructive/10 p-2 text-destructive">
                  Restream migration chưa sẵn sàng. Deploy migration rồi refresh lại.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Destination Status</CardTitle>
        </CardHeader>
        <CardContent>
          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Restream destination status yet.</p>
          ) : (
            <div className="space-y-3">
              {destinations.map((destination) => (
                <div key={destination.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium capitalize">{destination.platform} {destination.display_name ? `- ${destination.display_name}` : ''}</div>
                      <div className="truncate text-xs text-muted-foreground">Live: {destination.live_session_id}</div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={destination.status === 'live' ? 'default' : destination.status === 'failed' ? 'destructive' : 'secondary'}>
                        {destination.status}
                      </Badge>
                      <Badge variant="outline">{destination.signal_status}</Badge>
                    </div>
                  </div>
                  {destination.last_error && (
                    <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      {destination.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restream API Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Restream API logs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Endpoint</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Live</th>
                    <th className="py-2 pr-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-medium">{log.action}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{log.method || ''} {log.endpoint || ''}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={log.success ? 'default' : 'destructive'}>{log.status_code || (log.success ? 'ok' : 'failed')}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{log.live_session_id || '-'}</td>
                      <td className="py-2 pr-3 text-destructive">{log.error_message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
