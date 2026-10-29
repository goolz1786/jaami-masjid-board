import type { ContentItem, DisplayState } from './masjid-types';
import { isContentActive } from './content-scheduling';
import { publicDisplayState } from './public-state';

export type BoardPreview = {
  profile: 'MAIN' | 'COMMUNITY';
  state: DisplayState;
  item: ContentItem;
};

export function buildContentPreview(
  state: DisplayState,
  item: ContentItem,
  now = new Date(),
): BoardPreview {
  if (item.displayProfile !== 'MAIN' && item.displayProfile !== 'COMMUNITY') {
    throw new Error('Choose Main or Community to preview a TV layout.');
  }
  const hasPanel =
    item.displayProfile === 'COMMUNITY'
      ? [
          'JANAZAH',
          'NIKAH',
          'SICK_DUA',
          'LADIES_TALEEM',
          'EXTERNAL_POSTER',
        ].includes(item.type)
      : ['JANAZAH', 'NIKAH', 'SICK_DUA', 'WHATSAPP_QR'].includes(item.type) ||
        ['MAIN_FEATURE', 'IMPORTANT', 'COMMUNITY', 'DONATE'].includes(
          item.zone,
        );
  if (!hasPanel && !item.takeover) {
    throw new Error(
      'This notice is not shown in the selected TV layout. Choose a matching display profile and target zone.',
    );
  }
  const visible = publicDisplayState(state, now);
  const previewItem = {
    ...item,
    details: Object.fromEntries(
      Object.entries(item.details).filter(([key]) => key !== 'notes'),
    ),
  };
  return {
    profile: item.displayProfile,
    item: previewItem,
    state: {
      ...visible,
      contentItems: [
        ...visible.contentItems.filter((saved) => saved.id !== item.id),
        previewItem,
      ],
    },
  };
}

export function contentVisibleOnBoard(
  item: ContentItem,
  now: Date,
  previewId?: number,
): boolean {
  return item.id === previewId || isContentActive(item, now);
}
