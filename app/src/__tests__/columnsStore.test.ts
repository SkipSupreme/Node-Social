// TDD: Tests written FIRST for columns store vibeSettings functionality
import { useColumnsStore, FeedColumn, ColumnType, ColumnVibeSettings } from '../store/columns';
import { storage } from '../lib/storage';

// Mock storage
jest.mock('../lib/storage', () => ({
  storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedStorage = storage as jest.Mocked<typeof storage>;

// Sample vibeSettings for testing
const sampleVibeSettings: ColumnVibeSettings = {
  preset: 'balanced',
  weights: {
    quality: 35,
    recency: 30,
    engagement: 20,
    personalization: 15,
  },
};

const customVibeSettings: ColumnVibeSettings = {
  preset: 'custom',
  weights: {
    quality: 50,
    recency: 20,
    engagement: 20,
    personalization: 10,
  },
};

describe('Columns Store - vibeSettings', () => {
  beforeEach(() => {
    // Reset store state before each test
    useColumnsStore.setState({
      columns: [],
      isMultiColumnEnabled: true,
      isLoading: true,
    });
    jest.clearAllMocks();
  });

  describe('addColumn with vibeSettings', () => {
    it('adds column with vibeSettings', async () => {
      const store = useColumnsStore.getState();

      await store.addColumn({
        type: 'discovery',
        title: 'Discovery',
        vibeSettings: sampleVibeSettings,
      });

      const columns = useColumnsStore.getState().columns;
      expect(columns).toHaveLength(1);
      expect(columns[0].vibeSettings).toEqual(sampleVibeSettings);
    });

    it('persists vibeSettings to storage', async () => {
      const store = useColumnsStore.getState();

      await store.addColumn({
        type: 'global',
        title: 'Global Feed',
        vibeSettings: sampleVibeSettings,
      });

      expect(mockedStorage.setItem).toHaveBeenCalled();

      const savedData = JSON.parse(mockedStorage.setItem.mock.calls[0][1]);
      expect(savedData.columns[0].vibeSettings).toEqual(sampleVibeSettings);
    });

    it('adds column without vibeSettings (undefined)', async () => {
      const store = useColumnsStore.getState();

      await store.addColumn({
        type: 'notifications',
        title: 'Notifications',
      });

      const columns = useColumnsStore.getState().columns;
      expect(columns).toHaveLength(1);
      expect(columns[0].vibeSettings).toBeUndefined();
    });
  });

  describe('updateColumn vibeSettings', () => {
    it('updates vibeSettings on existing column', async () => {
      // Setup: add a column first
      useColumnsStore.setState({
        columns: [
          { id: 'col-1', type: 'global', title: 'Global Feed', vibeSettings: sampleVibeSettings },
        ],
        isLoading: false,
      });

      const store = useColumnsStore.getState();
      await store.updateColumn('col-1', { vibeSettings: customVibeSettings });

      const columns = useColumnsStore.getState().columns;
      expect(columns[0].vibeSettings).toEqual(customVibeSettings);
    });

    it('can add vibeSettings to column that did not have it', async () => {
      useColumnsStore.setState({
        columns: [
          { id: 'col-1', type: 'global', title: 'Global Feed' },
        ],
        isLoading: false,
      });

      const store = useColumnsStore.getState();
      await store.updateColumn('col-1', { vibeSettings: sampleVibeSettings });

      const columns = useColumnsStore.getState().columns;
      expect(columns[0].vibeSettings).toEqual(sampleVibeSettings);
    });

    it('can remove vibeSettings from column', async () => {
      useColumnsStore.setState({
        columns: [
          { id: 'col-1', type: 'global', title: 'Global Feed', vibeSettings: sampleVibeSettings },
        ],
        isLoading: false,
      });

      const store = useColumnsStore.getState();
      await store.updateColumn('col-1', { vibeSettings: undefined });

      const columns = useColumnsStore.getState().columns;
      expect(columns[0].vibeSettings).toBeUndefined();
    });

    it('persists vibeSettings update to storage', async () => {
      useColumnsStore.setState({
        columns: [
          { id: 'col-1', type: 'global', title: 'Global Feed' },
        ],
        isLoading: false,
        isMultiColumnEnabled: true,
      });

      const store = useColumnsStore.getState();
      await store.updateColumn('col-1', { vibeSettings: customVibeSettings });

      expect(mockedStorage.setItem).toHaveBeenCalled();

      const savedData = JSON.parse(mockedStorage.setItem.mock.calls[0][1]);
      expect(savedData.columns[0].vibeSettings).toEqual(customVibeSettings);
    });
  });

  describe('loadFromStorage with vibeSettings', () => {
    it('restores vibeSettings from storage', async () => {
      const storedColumns: FeedColumn[] = [
        { id: 'col-1', type: 'global', title: 'Global', vibeSettings: sampleVibeSettings },
        { id: 'col-2', type: 'discovery', title: 'Discovery', vibeSettings: customVibeSettings },
        { id: 'col-3', type: 'notifications', title: 'Notifications' },
      ];

      mockedStorage.getItem.mockResolvedValueOnce(JSON.stringify({
        columns: storedColumns,
        isMultiColumnEnabled: true,
      }));

      const store = useColumnsStore.getState();
      await store.loadFromStorage();

      const columns = useColumnsStore.getState().columns;
      expect(columns).toHaveLength(3);
      expect(columns[0].vibeSettings).toEqual(sampleVibeSettings);
      expect(columns[1].vibeSettings).toEqual(customVibeSettings);
      expect(columns[2].vibeSettings).toBeUndefined();
    });

    it('handles columns without vibeSettings in storage', async () => {
      const storedColumns = [
        { id: 'col-1', type: 'global', title: 'Global' },
      ];

      mockedStorage.getItem.mockResolvedValueOnce(JSON.stringify({
        columns: storedColumns,
        isMultiColumnEnabled: true,
      }));

      const store = useColumnsStore.getState();
      await store.loadFromStorage();

      const columns = useColumnsStore.getState().columns;
      expect(columns[0].vibeSettings).toBeUndefined();
    });
  });

  describe('FeedColumn type includes vibeSettings', () => {
    it('FeedColumn interface supports vibeSettings property', () => {
      const column: FeedColumn = {
        id: 'test-col',
        type: 'global',
        title: 'Test',
        vibeSettings: sampleVibeSettings,
      };

      expect(column.vibeSettings).toBeDefined();
      expect(column.vibeSettings?.preset).toBe('balanced');
    });
  });
});
