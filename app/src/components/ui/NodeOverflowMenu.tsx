import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Share, Platform } from 'react-native';
import { VolumeX, Volume2, LogOut, Link2, Flag, X } from './Icons';
import { COLORS } from '../../constants/theme';
import { muteNode, unmuteNode, leaveNode } from '../../lib/api';
import { showAlert, confirmAction } from '../../lib/alert';

interface NodeOverflowMenuProps {
  nodeId: string;
  nodeName: string;
  nodeSlug: string;
  isMember: boolean;
  isMuted: boolean;
  isAdmin: boolean;
  visible: boolean;
  onClose: () => void;
  onMuteChange: (muted: boolean) => void;
  onLeave: () => void;
}

export function NodeOverflowMenu({
  nodeId,
  nodeName,
  nodeSlug,
  isMember,
  isMuted,
  isAdmin,
  visible,
  onClose,
  onMuteChange,
  onLeave,
}: NodeOverflowMenuProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleMuteToggle = async () => {
    setLoading('mute');
    try {
      if (isMuted) {
        await unmuteNode(nodeId);
        onMuteChange(false);
      } else {
        await muteNode(nodeId);
        onMuteChange(true);
      }
      onClose();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      showAlert('Error', 'Failed to update mute setting');
    } finally {
      setLoading(null);
    }
  };

  const handleLeave = async () => {
    if (isAdmin) {
      showAlert('Cannot Leave', 'You are the admin of this node. Transfer admin role to another member first.');
      return;
    }

    confirmAction(
      'Leave Node',
      `Are you sure you want to leave n/${nodeSlug}?`,
      async () => {
        setLoading('leave');
        try {
          await leaveNode(nodeId);
          onLeave();
          onClose();
        } catch (error: unknown) {
          console.error('Failed to leave node:', error);
          showAlert('Error', error instanceof Error ? error.message : 'Failed to leave node');
        } finally {
          setLoading(null);
        }
      },
      { confirmText: 'Leave', destructive: true }
    );
  };

  const handleShare = async () => {
    try {
      const url = `https://nodesocial.app/n/${nodeSlug}`;
      if (Platform.OS === 'web') {
        // Try modern clipboard API first, fallback to execCommand
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          // Fallback for older browsers or non-HTTPS contexts
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        showAlert('Link Copied', 'Node link copied to clipboard!');
      } else {
        await Share.share({
          message: `Check out n/${nodeName} on NODEsocial: ${url}`,
          url,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to share:', error);
      showAlert('Error', 'Failed to copy link. Please try again.');
    }
  };

  const handleReport = () => {
    confirmAction(
      'Report Node',
      'Report this node for violating community guidelines?',
      () => {
        // TODO: Implement report API
        showAlert('Report Submitted', 'Thank you for your report. We will review it shortly.');
        onClose();
      },
      { confirmText: 'Report', destructive: true }
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menu}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Options</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={COLORS.node.muted} />
              </TouchableOpacity>
            </View>

            {/* Mute/Unmute */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMuteToggle}
              disabled={loading === 'mute'}
            >
              {isMuted ? (
                <Volume2 size={20} color={COLORS.node.text} />
              ) : (
                <VolumeX size={20} color={COLORS.node.text} />
              )}
              <Text style={styles.menuItemText}>
                {loading === 'mute' ? 'Updating...' : isMuted ? 'Unmute Node' : 'Mute Node'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.menuItemSubtext}>
              {isMuted ? 'Show posts from this node in your feed' : 'Hide posts from this node in your feed'}
            </Text>

            {/* Leave Node - only show if member */}
            {isMember && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleLeave}
                  disabled={loading === 'leave'}
                >
                  <LogOut size={20} color="#ef4444" />
                  <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
                    {loading === 'leave' ? 'Leaving...' : 'Leave Node'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.menuItemSubtext}>
                  Leave this community
                </Text>
              </>
            )}

            {/* Share */}
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Link2 size={20} color={COLORS.node.text} />
              <Text style={styles.menuItemText}>Share Node</Text>
            </TouchableOpacity>
            <Text style={styles.menuItemSubtext}>
              Copy link to share
            </Text>

            {/* Report */}
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Flag size={20} color="#f59e0b" />
              <Text style={[styles.menuItemText, { color: '#f59e0b' }]}>Report Node</Text>
            </TouchableOpacity>
            <Text style={styles.menuItemSubtext}>
              Report for violating guidelines
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '90%',
    maxWidth: 320,
  },
  menu: {
    backgroundColor: COLORS.node.panel,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.node.text,
  },
  closeButton: {
    padding: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.node.text,
  },
  menuItemSubtext: {
    fontSize: 12,
    color: COLORS.node.muted,
    marginLeft: 32,
    marginTop: -8,
    marginBottom: 8,
  },
});
