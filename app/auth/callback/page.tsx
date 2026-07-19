'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (exchangeError) throw exchangeError;
        if (cancelled) return;
        const next = searchParams.get('next') || '/dashboard';
        router.replace(next);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => router.replace('/login'), 1500);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {error ? <p>{error}</p> : <p>Finishing sign in…</p>}
    </div>
  );
}
