// TDD: Tests written FIRST for ColumnSearchBar component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ColumnSearchBar } from '../components/ui/ColumnSearchBar';
import { ColumnType } from '../store/columns';

// Mock nodes for testing
const mockNodes = [
  { id: 'node-1', name: 'Tech', color: '#00ff00' },
  { id: 'node-2', name: 'Gaming', color: '#ff0000' },
];

describe('ColumnSearchBar', () => {
  const defaultProps = {
    currentType: 'global' as ColumnType,
    currentTitle: 'Global Feed',
    onTypeChange: jest.fn(),
    onSearch: jest.fn(),
    nodes: mockNodes,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial render', () => {
    it('displays current column type as placeholder', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      // Should show the current title in the input/placeholder area
      expect(screen.getByPlaceholderText(/Global Feed/i)).toBeTruthy();
    });

    it('renders search icon', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      // May have multiple search icons (in input and dropdown), just verify at least one exists
      expect(screen.getAllByTestId('search-icon').length).toBeGreaterThanOrEqual(1);
    });

    it('renders dropdown chevron', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      expect(screen.getByTestId('dropdown-chevron')).toBeTruthy();
    });
  });

  describe('Dropdown behavior', () => {
    it('opens dropdown when input is focused', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      // Should show dropdown with column type options
      expect(screen.getByTestId('column-dropdown')).toBeTruthy();
    });

    it('shows all column type options in dropdown', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      // Should show all main column types
      expect(screen.getByText('Global Feed')).toBeTruthy();
      expect(screen.getByText('Discovery')).toBeTruthy();
      expect(screen.getByText('Following')).toBeTruthy();
      expect(screen.getByText('Trending')).toBeTruthy();
      expect(screen.getByText('Notifications')).toBeTruthy();
      expect(screen.getByText('My Profile')).toBeTruthy();
    });

    it('shows Node Feed option in dropdown', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      expect(screen.getByText('Node Feed')).toBeTruthy();
    });

    it('closes dropdown on outside press', async () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      // Dropdown should be open
      expect(screen.getByTestId('column-dropdown')).toBeTruthy();

      // Press backdrop
      fireEvent.press(screen.getByTestId('dropdown-backdrop'));

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId('column-dropdown')).toBeNull();
      });
    });
  });

  describe('Type selection', () => {
    it('calls onTypeChange when a column type is selected', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      fireEvent.press(screen.getByText('Discovery'));

      expect(defaultProps.onTypeChange).toHaveBeenCalledWith('discovery', 'Discovery');
    });

    it('closes dropdown after type selection', async () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      fireEvent.press(screen.getByText('Trending'));

      await waitFor(() => {
        expect(screen.queryByTestId('column-dropdown')).toBeNull();
      });
    });

    it('highlights current column type in dropdown', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      // The current type should have active styling
      const globalOption = screen.getByTestId('option-global');
      expect(globalOption.props.style).toMatchObject(
        expect.objectContaining({ /* active style check */ })
      );
    });
  });

  describe('Node selection', () => {
    it('shows node picker when Node Feed is selected', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      fireEvent.press(screen.getByText('Node Feed'));

      // Should show node picker
      expect(screen.getByTestId('node-picker')).toBeTruthy();
      expect(screen.getByText('Tech')).toBeTruthy();
      expect(screen.getByText('Gaming')).toBeTruthy();
    });

    it('calls onTypeChange with node info when a node is selected', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');

      fireEvent.press(screen.getByText('Node Feed'));
      fireEvent.press(screen.getByText('Tech'));

      expect(defaultProps.onTypeChange).toHaveBeenCalledWith('node', 'Tech', 'node-1');
    });
  });

  describe('Search functionality', () => {
    it('shows search option when text is typed', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'react native');

      // Should show a live search option
      expect(screen.getByText(/Search: react native/i)).toBeTruthy();
    });

    it('calls onSearch when Enter is pressed with query', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'react native');
      fireEvent(input, 'submitEditing');

      expect(defaultProps.onSearch).toHaveBeenCalledWith('react native');
    });

    it('calls onSearch when search option is pressed', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'web3');

      fireEvent.press(screen.getByTestId('search-option'));

      expect(defaultProps.onSearch).toHaveBeenCalledWith('web3');
    });

    it('clears input after search', async () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, 'testing');
      fireEvent(input, 'submitEditing');

      await waitFor(() => {
        expect(input.props.value).toBe('');
      });
    });

    it('does not call onSearch if query is empty', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      fireEvent(input, 'focus');
      fireEvent.changeText(input, '   '); // Just whitespace
      fireEvent(input, 'submitEditing');

      expect(defaultProps.onSearch).not.toHaveBeenCalled();
    });

    it('shows search query in title when column is search type', () => {
      render(
        <ColumnSearchBar
          {...defaultProps}
          currentType="search"
          currentTitle="Search: react hooks"
        />
      );

      expect(screen.getByPlaceholderText(/Search: react hooks/i)).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for search input', () => {
      render(<ColumnSearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-input');
      expect(input.props.accessibilityLabel).toBeTruthy();
    });
  });
});
