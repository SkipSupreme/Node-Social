// TDD: Tests written FIRST for VibeValidatorModal component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { VibeValidatorModal } from '../components/ui/VibeValidatorModal';
import { ColumnVibeSettings } from '../store/columns';

const defaultSettings: ColumnVibeSettings = {
  preset: 'balanced',
  weights: {
    quality: 35,
    recency: 30,
    engagement: 20,
    personalization: 15,
  },
};

describe('VibeValidatorModal', () => {
  const defaultProps = {
    visible: true,
    settings: defaultSettings,
    onUpdate: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('renders when visible is true', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      expect(screen.getByTestId('vibe-validator-modal')).toBeTruthy();
    });

    it('does not render when visible is false', () => {
      render(<VibeValidatorModal {...defaultProps} visible={false} />);

      expect(screen.queryByTestId('vibe-validator-modal')).toBeNull();
    });
  });

  describe('Modal structure', () => {
    it('renders modal backdrop', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      expect(screen.getByTestId('modal-backdrop')).toBeTruthy();
    });

    it('renders modal content container', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      expect(screen.getByTestId('modal-content')).toBeTruthy();
    });

    it('renders VibeValidator inside modal', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      // VibeValidator has a title "Vibe Validator"
      expect(screen.getByText('Vibe Validator')).toBeTruthy();
    });
  });

  describe('Close behavior', () => {
    it('calls onClose when backdrop is pressed', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      fireEvent.press(screen.getByTestId('modal-backdrop'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is pressed', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      // VibeValidator has its own close button when onClose is provided
      // The modal might also have one - find and press it
      const closeButtons = screen.getAllByTestId('close-button');
      fireEvent.press(closeButtons[0]);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close when modal content is pressed', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      fireEvent.press(screen.getByTestId('modal-content'));

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Settings propagation', () => {
    it('passes settings to VibeValidator', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      // The "Balanced" preset should be shown as active since that's the current preset
      // This verifies settings are passed through
      expect(screen.getByText('Balanced')).toBeTruthy();
    });

    it('calls onUpdate when settings change in VibeValidator', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      // Click on a different preset to trigger an update
      fireEvent.press(screen.getByText('Latest First'));

      expect(defaultProps.onUpdate).toHaveBeenCalled();
    });
  });

  describe('Column title display', () => {
    it('displays column title when provided', () => {
      render(
        <VibeValidatorModal
          {...defaultProps}
          columnTitle="Discovery"
        />
      );

      expect(screen.getByText(/Discovery/)).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('modal has accessible role', () => {
      render(<VibeValidatorModal {...defaultProps} />);

      const modal = screen.getByTestId('vibe-validator-modal');
      expect(modal.props.accessibilityRole).toBe('dialog');
    });
  });
});
