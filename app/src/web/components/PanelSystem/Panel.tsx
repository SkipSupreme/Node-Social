// Phase 1.1 - Panel Component
// Individual draggable/resizable panel

import React, { ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import type { Panel } from '../../store/panelLayout';

interface PanelProps {
  panel: Panel;
  children: ReactNode;
  onDragStart?: () => void;
  onDrag?: (x: number, y: number) => void;
  onDragEnd?: () => void;
  onResize?: (width: number, height: number) => void;
  onMinimize?: () => void;
  onClose?: () => void;
  title?: string;
}

export const PanelComponent: React.FC<PanelProps> = ({
  panel,
  children,
  onDragStart,
  onDrag,
  onDragEnd,
  onResize,
  onMinimize,
  onClose,
  title,
}) => {
  if (panel.minimized) {
    return (
      <View
        style={[
          styles.minimizedPanel,
          {
            left: panel.x,
            top: panel.y,
            width: panel.width,
            zIndex: panel.zIndex,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.minimizedHeader}
          onPress={onMinimize}
          activeOpacity={0.7}
        >
          {title && <Text style={styles.minimizedTitle}>{title}</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.panel,
        {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
          zIndex: panel.zIndex,
        },
      ]}
    >
      {/* Panel Header */}
      {(title || onMinimize || onClose) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {title && <Text style={styles.title}>{title}</Text>}
          </View>
          <View style={styles.headerRight}>
            {onMinimize && (
              <TouchableOpacity onPress={onMinimize} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>−</Text>
              </TouchableOpacity>
            )}
            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Panel Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  minimizedPanel: {
    position: 'absolute',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 32,
  },
  minimizedHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  minimizedTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 18,
    color: '#64748B',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});

