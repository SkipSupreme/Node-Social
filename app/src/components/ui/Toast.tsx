import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { subscribeToToasts } from '../../lib/alert';
import { useAppTheme } from '../../hooks/useTheme';
import { CheckCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((message, type) => {
      const id = nextId.current++;
      setToasts(prev => [...prev, { id, message, type }]);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} message={toast.message} type={toast.type} />
      ))}
    </View>
  );
};

const ToastItem: React.FC<{ message: string; type: ToastType }> = ({ message, type }) => {
  const theme = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out before removal
    const fadeOutTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 2700);

    return () => clearTimeout(fadeOutTimer);
  }, []);

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;
  const iconColor = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : theme.accent;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], backgroundColor: theme.panel, borderColor: theme.border }]}>
      <Icon size={18} color={iconColor} />
      <Text style={[styles.toastText, { color: theme.text }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
    maxWidth: 400,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
