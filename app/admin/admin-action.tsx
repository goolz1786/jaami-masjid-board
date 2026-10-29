'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AdminActionButton({
  hint,
  ...props
}: ComponentProps<typeof Button> & { hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <Button
            {...props}
            className={cn('aria-disabled:opacity-50', props.className)}
            aria-label={props['aria-label'] ?? hint}
            focusableWhenDisabled
          />
        }
      />
      <TooltipContent className="px-3 py-2 text-sm font-medium">
        {props.disabled ? `${hint} (unavailable)` : hint}
      </TooltipContent>
    </Tooltip>
  );
}

export function AdminActionLink({
  hint,
  ...props
}: ComponentProps<'a'> & { hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={<a {...props} aria-label={props['aria-label'] ?? hint} />}
      />
      <TooltipContent className="px-3 py-2 text-sm font-medium">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
