// Test to verify React Native Testing Library works
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';

const TestComponent = ({ onPress }: { onPress?: () => void }) => (
  <View>
    <Text testID="greeting">Hello World</Text>
    <TouchableOpacity testID="button" onPress={onPress}>
      <Text>Click me</Text>
    </TouchableOpacity>
  </View>
);

describe('React Native Testing Library Setup', () => {
  it('renders text correctly', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('greeting')).toBeTruthy();
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('handles button press', () => {
    const mockPress = jest.fn();
    render(<TestComponent onPress={mockPress} />);

    fireEvent.press(screen.getByTestId('button'));
    expect(mockPress).toHaveBeenCalledTimes(1);
  });
});
