'use client';

import { useEffect, useState } from 'react';

type CycleState = { visible: boolean; index: number };

export function useTakeoverCycle(
  count: number,
  visibleMs: number,
  hiddenMs = visibleMs,
): number {
  const [state, setState] = useState<CycleState>({ visible: false, index: 0 });

  useEffect(() => {
    if (count <= 0) {
      setState({ visible: false, index: 0 });
      return;
    }
    let visible = true;
    let index = 0;
    let timer = 0;
    setState({ visible: true, index: 0 });
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (visible) {
            visible = false;
            index = (index + 1) % count;
          } else {
            visible = true;
          }
          setState({ visible, index });
          schedule();
        },
        visible ? visibleMs : hiddenMs,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [count, hiddenMs, visibleMs]);

  if (count <= 0 || !state.visible) return -1;
  return state.index % count;
}
