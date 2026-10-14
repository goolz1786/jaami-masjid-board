'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

const MAX_DIMENSION = 2600;

type RenderTask = { cancel: () => void; promise: Promise<void> };

export function PdfPoster({ src, title }: { src: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url'))
          .default as string;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const document = await pdfjs.getDocument({ url: src }).promise;
        const page = await document.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(
          MAX_DIMENSION / base.width,
          MAX_DIMENSION / base.height,
          4,
        );
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
      } catch {
        if (!cancelled) setFailedSrc(src);
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
    };
  }, [src]);

  if (failedSrc === src)
    return (
      <div className="poster-pdf-fallback">
        <FileText />
        <strong>{title}</strong>
      </div>
    );

  return (
    <canvas
      ref={canvasRef}
      className="poster-pdf-canvas"
      aria-label={`${title} poster`}
    />
  );
}
