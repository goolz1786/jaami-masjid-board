import type { ContentItem } from './masjid-types';

export type PosterPage = {
  id: string;
  items: ContentItem[];
  displayDuration: number;
};

export function posterLayoutClass(count: number) {
  return `poster-count-${Math.max(1, Math.min(6, count))}`;
}

export function shouldRotatePosterPages(posterCount: number) {
  return posterCount > 1;
}

export function buildPosterPages(
  posters: ContentItem[],
  requestedDuration = 18,
): PosterPage[] {
  const displayDuration = Math.max(15, Math.min(20, requestedDuration || 18));
  return posters.map((item, index) => ({
    id: `poster-page-${index}-${item.id}`,
    items: [item],
    displayDuration,
  }));
}
