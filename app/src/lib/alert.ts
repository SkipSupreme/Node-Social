/**
 * Cross-platform alert utilities
 *
 * React Native's Alert.alert() only works on iOS and Android.
 * On web, it silently does nothing. This utility provides
 * cross-platform alert and confirm dialogs that work everywhere.
 */

import { Alert, Platform } from 'react-native';

// Simple event-based toast system
type ToastType = 'success' | 'error' | 'info';
type ToastListener = (message: string, type: ToastType) => void;

const toastListeners: Set<ToastListener> = new Set();

export const subscribeToToasts = (listener: ToastListener): (() => void) => {
  toastListeners.add(listener);
  return () => { toastListeners.delete(listener); };
};

/**
 * Show a brief toast notification
 */
export const showToast = (message: string, type: ToastType = 'info') => {
  toastListeners.forEach(listener => listener(message, type));
};

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

