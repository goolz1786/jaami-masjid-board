'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildContentPreview } from '@/lib/board-preview';
import type { ContentItem, DisplayState } from '@/lib/masjid-types';
import './notice-preview.css';

export function NoticePreview({
  state,
  item,
}: {
  state: DisplayState;
  item: ContentItem;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [retry, setRetry] = useState(0);
  const [fullscreenUnavailable, setFullscreenUnavailable] = useState(false);
  const result = useMemo(() => {
    try {
      return { preview: buildContentPreview(state, item), error: '' };
    } catch (error) {
      return {
        preview: null,
        error: error instanceof Error ? error.message : 'Preview unavailable.',
      };
    }
  }, [state, item]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [result.error]);

  useEffect(() => {
    if (!result.preview) return;
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        { type: 'board-preview-state', preview: result.preview },
        window.location.origin,
      );
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      if (event.data?.type === 'board-preview-ready') {
        send();
        return;
      }
      if (event.data?.type !== 'board-preview-applied') return;
      window.clearTimeout(timeout);
      setStatus('ready');
    };
    const timeout = window.setTimeout(() => setStatus('error'), 20000);
    window.addEventListener('message', receive);
    send();
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [result, retry]);

  if (!result.preview)
    return (
      <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-950">
        {result.error}
      </p>
    );
  const portrait = result.preview.profile === 'COMMUNITY';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const scale = Math.min(size.width / width, size.height / height);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {portrait ? 'Community Board · 9:16' : 'Main Masjid Board · 16:9'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!stage.current?.requestFullscreen) {
              setFullscreenUnavailable(true);
              return;
            }
            void stage.current
              .requestFullscreen()
              .catch(() => setFullscreenUnavailable(true));
          }}
        >
          <Maximize /> Full screen
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Preview only. This notice is shown regardless of its schedule or status.
        Nothing is published or enabled here.
      </p>
      {fullscreenUnavailable && (
        <p className="text-sm text-muted-foreground">
          Full screen is unavailable in this browser. The preview below still
          works.
        </p>
      )}
      {status === 'loading' && (
        <output className="block text-sm text-muted-foreground">
          Loading TV preview…
        </output>
      )}
      {status === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
        >
          Preview could not open. Your sign-in may have expired; reload admin if
          retry does not help.
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatus('loading');
              setRetry((value) => value + 1);
            }}
          >
            <RotateCcw /> Retry preview
          </Button>
        </div>
      )}
      <div
        ref={stage}
        className="notice-preview-stage relative mx-auto overflow-hidden rounded-lg border bg-[#05070a]"
        style={{
          width: portrait ? 'min(100%, 34vh)' : 'min(100%, 106vh)',
          aspectRatio: `${width} / ${height}`,
        }}
      >
        <iframe
          key={`${result.preview.profile}-${retry}`}
          ref={frame}
          src="/admin/preview"
          title={`TV preview of ${item.title || 'notice'}`}
          className="absolute left-1/2 top-1/2 border-0"
          style={{
            width,
            height,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}

export function NoticePreviewDialog({
  state,
  item,
  onClose,
}: {
  state: DisplayState;
  item: ContentItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>TV preview: {item?.title}</DialogTitle>
          <DialogDescription>
            Inspect this notice without changing the live board.
          </DialogDescription>
        </DialogHeader>
        {item && <NoticePreview key={item.id} state={state} item={item} />}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
