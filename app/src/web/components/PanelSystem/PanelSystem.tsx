// Phase 1.1 - Panel System Main Container
// Container for all draggable/resizable panels

import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { usePanelLayout } from '../../store/panelLayout';

interface PanelSystemProps {
  children: ReactNode;
  className?: string;
}

export const PanelSystem: React.FC<PanelSystemProps> = ({ children, className }) => {
  const { panels } = usePanelLayout();

  return (
    <View style={[styles.container, className]} pointerEvents="box-none">
      {/* Render all panels based on state */}
      {Object.values(panels).map((panel) => (
        <View
          key={panel.id}
          style={[
            styles.panelSlot,
            {
              left: panel.x,
              top: panel.y,
              width: panel.width,
              height: panel.height,
              zIndex: panel.zIndex,
            },
          ]}
        >
          {/* Panel content will be rendered by child components */}
        </View>
      ))}

      {/* Main content area */}
      <View style={styles.contentArea}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  panelSlot: {
    position: 'absolute',
  },
  contentArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

