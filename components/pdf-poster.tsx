'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

const MAX_DIMENSION = 2600;

type RenderTask = { cancel: () => void; promise: Promise<void> };

export function PdfPoster({
  src,
  title,
  maxDimension = MAX_DIMENSION,
  className = '',
}: {
  src: string;
  title: string;
  maxDimension?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [renderedSrc, setRenderedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;
    let loadingTask: { destroy: () => Promise<void> } | null = null;

    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
          .default as string;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        if (cancelled) return;
        const loading = pdfjs.getDocument({ url: src });
        loadingTask = loading;
        const document = await loading.promise;
        if (cancelled) return;
        const page = await document.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(
          maxDimension / base.width,
          maxDimension / base.height,
          4,
        );
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
        if (!cancelled) setRenderedSrc(src);
      } catch {
        if (!cancelled) setFailedSrc(src);
      } finally {
        // The canvas keeps its bitmap; do not retain a whole PDF and worker per thumbnail.
        const completed = loadingTask;
        loadingTask = null;
        await completed?.destroy().catch(() => undefined);
      }
    }

    void render();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* render already finished */
      }
      void loadingTask?.destroy().catch(() => undefined);
      loadingTask = null;
    };
  }, [src, maxDimension]);

  if (failedSrc === src)
    return (
      <figure
        className={`poster-pdf-fallback ${className}`}
        aria-label={`PDF preview unavailable: ${title}`}
      >
        <FileText />
        <span className={maxDimension < MAX_DIMENSION ? 'sr-only' : ''}>
          {title}
        </span>
      </figure>
    );

  return (
    <canvas
      ref={canvasRef}
      className={`poster-pdf-canvas ${className}`}
      aria-label={`${title} poster`}
      aria-busy={renderedSrc !== src}
    />
  );
}
