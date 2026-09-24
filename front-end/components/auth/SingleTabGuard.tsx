import React, { ReactNode, useEffect, useState } from 'react';

export default function SingleTabGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'active' | 'blocked' | 'unavailable'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let release: (() => void) | undefined;
    setState('checking');

    if (!navigator.locks) {
      setState('unavailable');
      return;
    }

    // The browser arbitrates simultaneous tabs and releases the lock on close/crash.
    void navigator.locks.request('verifast-active-tab', { ifAvailable: true }, async lock => {
      if (disposed) return;
      if (!lock) { setState('blocked'); return; }
      await new Promise<void>(resolve => {
        release = resolve;
        setState('active');
      });
    }).catch(() => {
      if (!disposed) setState('unavailable');
    });

    const hide = () => {
      disposed = true;
      setState('checking');
      release?.();
    };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      disposed = true;
      release?.();
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [attempt]);

  if (state === 'active') return <>{children}</>;

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md text-center space-y-4" role="status" aria-live="polite">
        <p className="text-lg font-semibold text-primary-600">VeriFast</p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {state === 'blocked' ? 'Already open in another tab' : state === 'checking' ? 'Checking session...' : 'Unable to check active tabs'}
        </h1>
        {state === 'blocked' && <p className="text-gray-600 dark:text-gray-300">Only one VeriFast tab is allowed. Continue in your existing tab, or close it and try again here.</p>}
        {state === 'unavailable' && <p className="text-gray-600 dark:text-gray-300">Open VeriFast using HTTPS in a browser that supports tab locking.</p>}
        {state !== 'checking' && <button onClick={() => setAttempt(value => value + 1)} className="px-5 py-3 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700">Try Again</button>}
      </section>
    </main>
  );
}
