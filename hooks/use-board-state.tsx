'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { defaultDisplayState, type DisplayState } from '@/lib/masjid-types';
import type { BoardPreview } from '@/lib/board-preview';

export const BoardPreviewContext = createContext<BoardPreview | null>(null);

export function useBoardState() {
  const preview = useContext(BoardPreviewContext);
  const [liveState, setLiveState] = useState<DisplayState>(defaultDisplayState);

  useEffect(() => {
    // A private preview uses only its parent's in-memory snapshot.
    if (preview) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as DisplayState;
        if (active) setLiveState(next);
      } catch {
        /* Retain the last valid board during network interruption. */
      }
    };
    void load();
    const timer = window.setInterval(
      load,
      Math.max(3, liveState.settings.refreshInterval) * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [preview, liveState.settings.refreshInterval]);

  return { state: preview?.state ?? liveState, previewItem: preview?.item };
}
