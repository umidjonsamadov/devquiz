'use client';

import { useEffect } from 'react';

const INTERVAL_MS = 30 * 1000;

// Ko'rinmas komponent: sahifa ochiq va ko'rinib turganda serverga "men shu yerdaman" signalini yuboradi.
export default function PresenceTracker() {
    useEffect(() => {
        const ping = () => {
            if (document.visibilityState !== 'visible') return;
            fetch('/api/user/heartbeat', { method: 'POST' }).catch(() => {});
        };
        ping();
        const id = setInterval(ping, INTERVAL_MS);
        document.addEventListener('visibilitychange', ping);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', ping);
        };
    }, []);

    return null;
}
