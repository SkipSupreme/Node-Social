// Main Web Layout Component
// Phase 1-3 - Integrates all panels: Left Sidebar, Center Feed, Right Sidebar

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { LeftSidebar } from './Sidebars/LeftSidebar';
import { RightSidebarTop } from './Sidebars/RightSidebarTop';
import { RightSidebarBottom } from './Sidebars/RightSidebarBottom';
import { FeedColumn } from './Feeds/FeedColumn';
import type { Node } from '../../lib/api';

const LEFT_SIDEBAR_WIDTH = 240;
const RIGHT_SIDEBAR_WIDTH = 300;
const HEADER_HEIGHT = 56; // Matches web header height in App.tsx

interface WebLayoutProps {
  children?: React.ReactNode; // Optional children for custom layouts
}

export const WebLayout: React.FC<WebLayoutProps> = ({ children }) => {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  // Update dimensions on window resize (web)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setDimensions(window);
      });
      return () => subscription?.remove();
    }
  }, []);

  // Calculate layout dimensions
  const leftWidth = leftCollapsed ? 40 : LEFT_SIDEBAR_WIDTH;
  const rightWidth = RIGHT_SIDEBAR_WIDTH;
  const centerWidth = dimensions.width - leftWidth - rightWidth;
  const availableHeight = dimensions.height - HEADER_HEIGHT;
  const rightHeight = availableHeight / 2;

  // Load node details when selected
  useEffect(() => {
    if (selectedNodeId) {
      // Node details will be loaded by FeedColumn and passed via onNodeLoad
    } else {
      setSelectedNode(null);
    }
  }, [selectedNodeId]);

  return (
    <View style={[styles.container, { height: availableHeight }]}>
      {/* Left Sidebar */}
      <View style={[styles.leftSidebar, { width: leftWidth, height: availableHeight }]}>
        <LeftSidebar
          selectedNodeId={selectedNodeId}
          onNodeSelect={(nodeId) => {
            setSelectedNodeId(nodeId);
          }}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
        />
      </View>

      {/* Center Feed Area */}
      <View style={[styles.centerArea, { width: centerWidth, height: availableHeight }]}>
        {children || (
          <FeedColumn
            nodeId={selectedNodeId}
            width={centerWidth}
            onNodeLoad={setSelectedNode}
          />
        )}
      </View>

      {/* Right Sidebar */}
      <View style={[styles.rightSidebar, { width: rightWidth, height: availableHeight }]}>
        {/* Top: Vibe Validator */}
        <View style={[styles.rightSidebarTop, { height: rightHeight }]}>
          <RightSidebarTop />
        </View>

        {/* Bottom: Node Info */}
        <View style={[styles.rightSidebarBottom, { height: rightHeight }]}>
          <RightSidebarBottom node={selectedNode} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    position: 'relative',
  },
  leftSidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    overflow: 'hidden',
  },
  centerArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  rightSidebar: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  rightSidebarTop: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    overflow: 'hidden',
  },
  rightSidebarBottom: {
    width: '100%',
    overflow: 'hidden',
  },
});

