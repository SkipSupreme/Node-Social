// TDD: Tests for FeedColumn header refactor
// Tests that all column types use the new ColumnSearchBar and have consistent header behavior
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedColumn } from '../components/ui/FeedColumn';
import { FeedColumn as FeedColumnType, ColumnType } from '../store/columns';

// Mock API calls
jest.mock('../lib/api', () => ({
  getFeed: jest.fn(() => Promise.resolve({ posts: [], hasMore: false })),
  searchPosts: jest.fn(() => Promise.resolve({ posts: [], hasMore: false })),
  getUserPosts: jest.fn(() => Promise.resolve([])),
  getNotifications: jest.fn(() => Promise.resolve({ notifications: [] })),
  markNotificationsRead: jest.fn(() => Promise.resolve()),
  getWhatsVibing: jest.fn(() => Promise.resolve({ vibes: [], posts: [] })),
  getTrendingVibes: jest.fn(() => Promise.resolve([])),
  getTrendingNodes: jest.fn(() => Promise.resolve([])),
  getDiscoverNodes: jest.fn(() => Promise.resolve([])),
}));

// Create a wrapper with QueryClient for components that need it
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

const mockNodes = [
  { id: 'node-1', name: 'Tech', color: '#00ff00' },
  { id: 'node-2', name: 'Gaming', color: '#ff0000' },
];

const mockCurrentUser = {
  id: 'user-1',
  username: 'testuser',
};

const createColumn = (type: ColumnType, title: string, overrides = {}): FeedColumnType => ({
  id: `col-${type}`,
  type,
  title,
  ...overrides,
});

describe('FeedColumn Header', () => {
  const defaultProps = {
    currentUser: mockCurrentUser,
    nodes: mockNodes,
    globalNodeId: 'global',
    onPostClick: jest.fn(),
    onAuthorClick: jest.fn(),
    onUserClick: jest.fn(),
    onPostAction: jest.fn(),
    onSaveToggle: jest.fn(),
    onRemove: jest.fn(),
    canRemove: true,
    onNodeClick: jest.fn(),
    onMoveLeft: jest.fn(),
    onMoveRight: jest.fn(),
    onUpdateColumn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Search bar consistency across all column types', () => {
    const columnTypes: { type: ColumnType; title: string }[] = [
      { type: 'global', title: 'Global Feed' },
      { type: 'discovery', title: 'Discovery' },
      { type: 'following', title: 'Following' },
      { type: 'trending', title: 'Trending' },
      { type: 'notifications', title: 'Notifications' },
      { type: 'profile', title: 'My Profile' },
      { type: 'search', title: 'Search: react' },
      { type: 'node', title: 'Tech' },
    ];

    columnTypes.forEach(({ type, title }) => {
      it(`${type} column renders with ColumnSearchBar`, async () => {
        renderWithProviders(
          <FeedColumn
            {...defaultProps}
            column={createColumn(type, title, type === 'search' ? { searchQuery: 'react' } : {})}
          />
        );

        // All columns should have the search input
        await waitFor(() => {
          expect(screen.getByTestId('search-input')).toBeTruthy();
        });
      });

      it(`${type} column can open type dropdown`, async () => {
        renderWithProviders(
          <FeedColumn
            {...defaultProps}
            column={createColumn(type, title, type === 'search' ? { searchQuery: 'react' } : {})}
          />
        );

        await waitFor(() => {
          const input = screen.getByTestId('search-input');
          fireEvent(input, 'focus');
        });

        // Dropdown should be visible
        expect(screen.getByTestId('column-dropdown')).toBeTruthy();
      });
    });
  });

  describe('Settings button visibility', () => {
    it('shows settings button for global column', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeTruthy();
      });
    });

    it('shows settings button for discovery column', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('discovery', 'Discovery')}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeTruthy();
      });
    });

    it('shows settings button for search column', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('search', 'Search: react', { searchQuery: 'react' })}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-button')).toBeTruthy();
      });
    });

    it('hides settings button for notifications column', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('notifications', 'Notifications')}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('settings-button')).toBeNull();
      });
    });

    it('hides settings button for trending column', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('trending', 'Trending')}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('settings-button')).toBeNull();
      });
    });
  });

  describe('Settings button opens VibeValidatorModal', () => {
    it('opens VibeValidatorModal when settings button is pressed', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
        />
      );

      await waitFor(() => {
        fireEvent.press(screen.getByTestId('settings-button'));
      });

      expect(screen.getByTestId('vibe-validator-modal')).toBeTruthy();
    });
  });

  describe('Move buttons', () => {
    it('shows move left button when onMoveLeft is provided', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onMoveLeft={jest.fn()}
          onMoveRight={undefined}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('move-left-button')).toBeTruthy();
        expect(screen.queryByTestId('move-right-button')).toBeNull();
      });
    });

    it('shows move right button when onMoveRight is provided', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onMoveLeft={undefined}
          onMoveRight={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('move-left-button')).toBeNull();
        expect(screen.getByTestId('move-right-button')).toBeTruthy();
      });
    });

    it('calls onMoveLeft when move left button is pressed', async () => {
      const onMoveLeft = jest.fn();
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onMoveLeft={onMoveLeft}
        />
      );

      await waitFor(() => {
        fireEvent.press(screen.getByTestId('move-left-button'));
      });

      expect(onMoveLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close button', () => {
    it('shows close button when canRemove is true', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          canRemove={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('remove-column-button')).toBeTruthy();
      });
    });

    it('hides close button when canRemove is false', async () => {
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          canRemove={false}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('remove-column-button')).toBeNull();
      });
    });

    it('calls onRemove when close button is pressed', async () => {
      const onRemove = jest.fn();
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onRemove={onRemove}
        />
      );

      await waitFor(() => {
        fireEvent.press(screen.getByTestId('remove-column-button'));
      });

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type change integration', () => {
    it('calls onUpdateColumn when column type is changed via search bar', async () => {
      const onUpdateColumn = jest.fn();
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onUpdateColumn={onUpdateColumn}
        />
      );

      await waitFor(() => {
        const input = screen.getByTestId('search-input');
        fireEvent(input, 'focus');
      });

      fireEvent.press(screen.getByText('Discovery'));

      expect(onUpdateColumn).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'discovery', title: 'Discovery' })
      );
    });

    it('calls onUpdateColumn with search query when searching', async () => {
      const onUpdateColumn = jest.fn();
      renderWithProviders(
        <FeedColumn
          {...defaultProps}
          column={createColumn('global', 'Global Feed')}
          onUpdateColumn={onUpdateColumn}
        />
      );

      await waitFor(() => {
        const input = screen.getByTestId('search-input');
        fireEvent(input, 'focus');
        fireEvent.changeText(input, 'typescript');
        fireEvent(input, 'submitEditing');
      });

      expect(onUpdateColumn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'search',
          searchQuery: 'typescript',
        })
      );
    });
  });
});
