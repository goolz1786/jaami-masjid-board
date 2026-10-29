'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, FileImage, FileText } from 'lucide-react';
import { PdfPoster } from './pdf-poster';
import type { ContentItem } from '@/lib/masjid-types';

export function PosterThumbnail({
  item,
  onClick,
}: {
  item: ContentItem;
  onClick: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [failedUrl, setFailedUrl] = useState('');
  const isPdf =
    item.details.posterMimeType === 'application/pdf' ||
    /\.pdf(?:$|[?#])/i.test(item.imageUrl);
  useEffect(() => {
    if (!isPdf) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' },
    );
    if (button.current) observer.observe(button.current);
    return () => observer.disconnect();
  }, [isPdf]);
  return (
    <button
      ref={button}
      type="button"
      onClick={onClick}
      aria-label={`Preview ${item.title} on TV`}
      title="Open TV preview"
      className="relative grid h-24 w-20 shrink-0 cursor-zoom-in place-items-center overflow-hidden rounded-md border bg-[#f5f1e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176354]"
    >
      {!item.imageUrl || failedUrl === item.imageUrl ? (
        <FileImage
          className="size-7 text-muted-foreground"
          aria-hidden="true"
        />
      ) : isPdf ? (
        visible ? (
          <PdfPoster
            src={item.imageUrl}
            title={item.title}
            maxDimension={192}
            className="h-full w-full object-contain"
          />
        ) : (
          <FileText
            className="size-7 text-muted-foreground"
            aria-hidden="true"
          />
        )
      ) : (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(item.imageUrl)}
        />
      )}
      <span className="absolute bottom-0 right-0 rounded-tl bg-[#0c1118] p-1 text-white">
        <Eye className="size-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
