'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { nextCarouselIndex } from '@/lib/carousel';

export function useIndependentCarousel<
  T extends { id: string | number; displayDuration?: number },
>(items: T[], defaultDuration: number, staggerMs = 0): T | undefined {
  const [index, setIndex] = useState(0);
  const firstCycle = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = useMemo(
    () => items.map((item) => item.id).join('|'),
    [items],
  );

  useEffect(() => {
    const currentItems = itemsRef.current;
    if (!currentItems.length) return;
    if (index >= currentItems.length) setIndex(0);
    const item = currentItems[index % currentItems.length];
    const delay = firstCycle.current
      ? staggerMs + Math.max(5, item.displayDuration ?? defaultDuration) * 1000
      : Math.max(5, item.displayDuration ?? defaultDuration) * 1000;
    firstCycle.current = false;
    const timer = window.setTimeout(
      () =>
        setIndex((current) => nextCarouselIndex(current, currentItems.length)),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [defaultDuration, index, signature, staggerMs]);

  return items.length ? items[index % items.length] : undefined;
}
