/**
 * Cross-platform alert utilities
 *
 * React Native's Alert.alert() only works on iOS and Android.
 * On web, it silently does nothing. This utility provides
 * cross-platform alert and confirm dialogs that work everywhere.
 */

import { Alert, Platform } from 'react-native';

/**
 * Show a simple alert message
 */
export const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    if (message) {
      window.alert(`${title}\n\n${message}`);
    } else {
      window.alert(title);
    }
  } else {
    Alert.alert(title, message);
  }
};

/**
 * Show a confirmation dialog with OK/Cancel
 * Returns a promise that resolves to true if confirmed, false if cancelled
 */
export const showConfirm = (
  title: string,
  message: string,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
): Promise<boolean> => {
  const { confirmText = 'OK', cancelText = 'Cancel' } = options || {};

  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result);
    } else {
      Alert.alert(title, message, [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: options?.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true)
        },
      ]);
    }
  });
};

/**
 * Show a confirmation dialog and execute callback if confirmed
 * This is the callback-style API for simpler usage
 */
export const confirmAction = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
) => {
  const { confirmText = 'OK', cancelText = 'Cancel' } = options || {};

  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      {
        text: confirmText,
        style: options?.destructive ? 'destructive' : 'default',
        onPress: () => onConfirm()
      },
    ]);
  }
};

/**
 * Show a prompt for text input (web only has basic support)
 */
export const showPrompt = (
  title: string,
  message: string,
  onSubmit: (value: string) => void,
  options?: {
    defaultValue?: string;
    placeholder?: string;
    submitText?: string;
    cancelText?: string;
  }
) => {
  const { defaultValue = '', submitText = 'OK', cancelText = 'Cancel' } = options || {};

  if (Platform.OS === 'web') {
    const result = window.prompt(`${title}\n\n${message}`, defaultValue);
    if (result !== null) {
      onSubmit(result);
    }
  } else {
    // On native, Alert.prompt is iOS only, so we just show an alert
    // For full prompt support on Android, you'd need a custom modal
    if (Platform.OS === 'ios') {
      Alert.prompt(
        title,
        message,
        [
          { text: cancelText, style: 'cancel' },
          { text: submitText, onPress: (value?: string) => onSubmit(value || '') },
        ],
        'plain-text',
        defaultValue
      );
    } else {
      // Android doesn't support Alert.prompt - show regular alert
      Alert.alert(title, message);
    }
  }
};
