'use client';

import { useEffect, useState } from 'react';
import DisplayPage from '@/app/display/page';
import CommunityDisplayPage from '@/app/display/community/page';
import { BoardPreviewContext } from '@/hooks/use-board-state';
import type { BoardPreview } from '@/lib/board-preview';

export function PreviewBoard() {
  const [preview, setPreview] = useState<BoardPreview | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      const data = event.data;
      if (data?.type !== 'board-preview-state') return;
      const next = data.preview as BoardPreview | undefined;
      if (
        !next?.state?.settings ||
        !Array.isArray(next.state.contentItems) ||
        !next.item
      )
        return;
      if (next.profile !== 'MAIN' && next.profile !== 'COMMUNITY') return;
      setPreview(next);
      window.parent.postMessage(
        { type: 'board-preview-applied' },
        window.location.origin,
      );
    };
    window.addEventListener('message', receive);
    window.parent.postMessage(
      { type: 'board-preview-ready' },
      window.location.origin,
    );
    return () => window.removeEventListener('message', receive);
  }, []);

  if (!preview) return <output>Waiting for a private notice preview.</output>;
  return (
    <BoardPreviewContext.Provider value={preview}>
      {preview.profile === 'COMMUNITY' ? (
        <CommunityDisplayPage />
      ) : (
        <DisplayPage />
      )}
    </BoardPreviewContext.Provider>
  );
}
