import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateDeviceHash(): Promise<string> {
  const components = [
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency?.toString() || 'unknown',
    `${navigator.maxTouchPoints}`,
  ];
  return sha256(components.join('|'));
}

/**
 * Collects device fingerprint once per session and sends to backend.
 * Only runs when user is authenticated.
 */
export const useDeviceFingerprint = (userId: string | null) => {
  useEffect(() => {
    if (!userId) return;

    const SESSION_KEY = `fp_sent_${userId}`;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const collect = async () => {
      try {
        const deviceHash = await generateDeviceHash();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/collect-fingerprint`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              device_hash: deviceHash,
              user_agent: navigator.userAgent,
            }),
          }
        );

        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      } catch (e) {
        // Silent fail - fingerprint collection is non-critical
        console.debug('[fingerprint] collection failed:', e);
      }
    };

    // Delay to not block initial render
    const timer = setTimeout(collect, 3000);
    return () => clearTimeout(timer);
  }, [userId]);
};

export default useDeviceFingerprint;
