import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

type LiveDebugRow = {
  id: string;
  user_id: string | null;
  host_user_id: string | null;
  title: string | null;
  status: string | null;
  recording_provider: string | null;
  recording_status: string | null;
  recording_error_code: string | null;
  recording_error_message: string | null;
  browser_recording_status: string | null;
  browser_recording_chunk_count: number | null;
  browser_recording_total_bytes: number | null;
  last_heartbeat_at: string | null;
  last_host_heartbeat_at: string | null;
  last_media_activity_at: string | null;
  stop_requested_at: string | null;
  stopped_at: string | null;
  recording_retry_count: number | null;
  client_state: string | null;
  disconnect_detected_at: string | null;
  cleanup_started_at: string | null;
  cleanup_finished_at: string | null;
  end_reason: string | null;
  watchdog_stop_result: Record<string, unknown> | null;
  last_recording_query_result: Record<string, unknown> | null;
  replay_url: string | null;
  created_at: string;
};

function formatBytes(value: number | null | undefined) {
  const bytes = Number(value || 0);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function LiveRecordingDebugTab() {
  const [rows, setRows] = useState<LiveDebugRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAgoraCount = useMemo(
    () => rows.filter((row) => row.recording_provider === 'agora' && ['starting', 'recording'].includes(String(row.recording_status))).length,
    [rows],
  );
  const suspectedGhostCount = useMemo(
    () => rows.filter((row) => {
      const last = row.last_heartbeat_at ? Date.parse(row.last_heartbeat_at) : 0;
      return ['live', 'reconnecting', 'disconnected', 'cleanup_pending'].includes(String(row.status)) && (!last || Date.now() - last > 30_000);
    }).length,
    [rows],
  );
  const cleanedCount = useMemo(
    () => rows.filter((row) => !!row.cleanup_finished_at).length,
    [rows],
  );
  const savedMinutes = useMemo(
    () => rows.reduce((sum, row) => {
      if (!row.cleanup_finished_at || !row.last_heartbeat_at) return sum;
      const savedMs = Date.parse(row.cleanup_finished_at) - Date.parse(row.last_heartbeat_at) - 90_000;
      return sum + Math.max(0, Math.round(savedMs / 60000));
    }, 0),
    [rows],
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await (supabase as any)
        .from('live_sessions')
        .select([
          'id',
          'user_id',
          'host_user_id',
          'title',
          'status',
          'recording_provider',
          'recording_status',
          'recording_error_code',
          'recording_error_message',
          'browser_recording_status',
          'browser_recording_chunk_count',
          'browser_recording_total_bytes',
          'last_heartbeat_at',
          'last_host_heartbeat_at',
          'last_media_activity_at',
          'stop_requested_at',
          'stopped_at',
          'recording_retry_count',
          'client_state',
          'disconnect_detected_at',
          'cleanup_started_at',
          'cleanup_finished_at',
          'end_reason',
          'watchdog_stop_result',
          'last_recording_query_result',
          'replay_url',
          'created_at',
        ].join(','))
        .order('created_at', { ascending: false })
        .limit(30);
      if (queryError) throw queryError;
      setRows((data || []) as LiveDebugRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu live recording.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Live Recording Debug</h2>
          <p className="text-sm text-muted-foreground">
            Live Watchdog / Agora Safety · Active Agora: {activeAgoraCount} · Suspected ghost: {suspectedGhostCount} · Cleaned: {cleanedCount} · Saved est: {savedMinutes}m
          </p>
        </div>
        <Button variant="outline" onClick={loadRows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? <Card className="p-4 text-sm text-destructive">{error}</Card> : null}

      <div className="grid gap-3">
        {rows.map((row) => {
          const replayExpected = row.recording_provider === 'agora' && row.recording_status !== 'failed';
          const heartbeatAt = row.last_host_heartbeat_at || row.last_heartbeat_at;
          const heartbeatAge = heartbeatAt ? Math.max(0, Math.round((Date.now() - Date.parse(heartbeatAt)) / 1000)) : null;
          const isGhostSuspect = ['live', 'reconnecting', 'disconnected', 'cleanup_pending'].includes(String(row.status)) && (heartbeatAge === null || heartbeatAge > 30);
          const zombieRecording = ['ended', 'processing', 'stopping'].includes(String(row.status)) && row.recording_provider === 'agora' && ['acquiring', 'starting', 'started', 'recording', 'stopping'].includes(String(row.recording_status));
          const stopStatus = row.watchdog_stop_result?.status;
          const queryStatus = row.last_recording_query_result?.status;
          return (
            <Card key={row.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{row.title || 'Untitled live'}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{row.id}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge variant={row.status === 'live' ? 'destructive' : 'secondary'} className="gap-1">
                    <Radio className="h-3 w-3" />
                    {row.status || 'unknown'}
                  </Badge>
                  <Badge variant="outline">{row.recording_provider || 'none'}</Badge>
                  <Badge variant={row.recording_status === 'failed' ? 'destructive' : 'secondary'}>
                    {row.recording_status || 'idle'}
                  </Badge>
                  {isGhostSuspect && <Badge variant="destructive">ghost?</Badge>}
                  {zombieRecording && <Badge variant="destructive">zombie rec</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Heartbeat</div>
                  <div>{heartbeatAge === null ? 'never' : `${heartbeatAge}s ago`}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Client state</div>
                  <div>{row.client_state || 'unknown'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">End reason</div>
                  <div>{row.end_reason || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Agora query/stop</div>
                  <div>{String(queryStatus ?? '-')} / {String(stopStatus ?? '-')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stop requested</div>
                  <div>{row.stop_requested_at ? new Date(row.stop_requested_at).toLocaleTimeString() : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stopped</div>
                  <div>{row.stopped_at ? new Date(row.stopped_at).toLocaleTimeString() : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Media active</div>
                  <div>{row.last_media_activity_at ? `${Math.max(0, Math.round((Date.now() - Date.parse(row.last_media_activity_at)) / 1000))}s ago` : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stop retries</div>
                  <div>{row.recording_retry_count || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Browser status</div>
                  <div>{row.browser_recording_status || 'idle'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Chunks</div>
                  <div>{row.browser_recording_chunk_count || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bytes</div>
                  <div>{formatBytes(row.browser_recording_total_bytes)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Replay expected</div>
                  <div>{row.replay_url ? 'Ready' : replayExpected ? 'Yes' : 'Fallback only'}</div>
                </div>
              </div>

              {(row.recording_error_code || row.recording_error_message) && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                  <div className="font-medium">{row.recording_error_code || 'Recording error'}</div>
                  <div className="text-muted-foreground break-words">{row.recording_error_message}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
