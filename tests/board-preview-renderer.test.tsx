import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DisplayPage from '../app/display/page';
import CommunityDisplayPage from '../app/display/community/page';
import { BoardPreviewContext } from '../hooks/use-board-state';
import { buildContentPreview } from '../lib/board-preview';
import { defaultDisplayState, type ContentItem } from '../lib/masjid-types';

const notice: ContentItem = {
  id: 7,
  type: 'JANAZAH',
  displayProfile: 'MAIN',
  zone: 'IMPORTANT',
  title: 'PREVIEW-ONLY-TITLE',
  subtitle: '',
  body: '',
  imageUrl: '',
  icon: 'megaphone',
  qrUrl: '',
  details: { deceasedName: 'PREVIEW-ONLY-NAME' },
  enabled: false,
  archived: true,
  sortOrder: 10,
  displayDuration: 12,
  startAt: '2030-01-01T10:00',
  endAt: '',
  recurringWeekdays: [],
  priority: 'NORMAL',
  takeover: false,
  createdAt: '',
  updatedAt: '',
};

describe('actual TV renderers in preview', () => {
  it('shows a main Janazah in the feature without duplicating it in its stored info zone', () => {
    const preview = buildContentPreview(defaultDisplayState, notice);
    const html = renderToStaticMarkup(
      <BoardPreviewContext.Provider value={preview}>
        <DisplayPage />
      </BoardPreviewContext.Provider>,
    );
    expect(html.match(/PREVIEW-ONLY-NAME/g)).toHaveLength(1);
    expect(html).not.toContain('<h3>PREVIEW-ONLY-TITLE</h3>');
  });

  it('shows the selected expired community poster instead of the first published poster', () => {
    const selected: ContentItem = {
      ...notice,
      type: 'EXTERNAL_POSTER',
      displayProfile: 'COMMUNITY',
      zone: 'COMMUNITY_POSTERS',
      imageUrl: '/SELECTED-POSTER.webp',
    };
    const state = {
      ...defaultDisplayState,
      contentItems: [
        {
          ...selected,
          id: 4,
          imageUrl: '/OTHER-POSTER.webp',
          enabled: true,
          archived: false,
          startAt: '',
        },
      ],
    };
    const preview = buildContentPreview(state, selected);
    const html = renderToStaticMarkup(
      <BoardPreviewContext.Provider value={preview}>
        <CommunityDisplayPage />
      </BoardPreviewContext.Provider>,
    );
    expect(html).toContain('/SELECTED-POSTER.webp');
    expect(html).not.toContain('/OTHER-POSTER.webp');
  });
});
