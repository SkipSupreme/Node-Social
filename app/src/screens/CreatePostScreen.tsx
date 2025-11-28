import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createPost, getNodes, type Node } from "../lib/api";
import { COLORS } from "../constants/theme";

type CreatePostScreenProps = {
  onSuccess: () => void;
  onCancel: () => void;
  nodeId?: string; // Optional: post to specific node
};

export const CreatePostScreen = ({ onSuccess, onCancel, nodeId: initialNodeId }: CreatePostScreenProps) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(initialNodeId);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [showNodeSelector, setShowNodeSelector] = useState(false);

  // Load nodes for selection
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const nodeList = await getNodes();
        setNodes(nodeList);
      } catch (error) {
        console.error('Failed to load nodes:', error);
      } finally {
        setLoadingNodes(false);
      }
    };
    loadNodes();
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      await createPost({
        content: content.trim(),
        nodeId: selectedNodeId,
      });
      onSuccess();
    } catch (error) {
      Alert.alert("Error", "Failed to create post. Please try again.");
      setLoading(false);
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={loading}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Post</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!content.trim() || loading}
            style={[
              styles.postButton,
              (!content.trim() || loading) && styles.postButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Node Selector */}
        <View style={styles.nodeSelectorContainer}>
          <TouchableOpacity
            style={styles.nodeSelectorButton}
            onPress={() => setShowNodeSelector(!showNodeSelector)}
            disabled={loadingNodes}
          >
            <Text style={styles.nodeSelectorText}>
              {selectedNode ? `n/${selectedNode.slug}` : 'Select Community'}
            </Text>
            <Text style={styles.nodeSelectorArrow}>{showNodeSelector ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showNodeSelector && !loadingNodes && (
            <ScrollView style={styles.nodeSelectorDropdown} nestedScrollEnabled>
              <TouchableOpacity
                style={[styles.nodeOption, !selectedNodeId && styles.nodeOptionSelected]}
                onPress={() => {
                  setSelectedNodeId(undefined);
                  setShowNodeSelector(false);
                }}
              >
                <Text style={[styles.nodeOptionText, !selectedNodeId && styles.nodeOptionTextSelected]}>
                  All Communities (Global)
                </Text>
              </TouchableOpacity>
              {nodes.map((node) => (
                <TouchableOpacity
                  key={node.id}
                  style={[styles.nodeOption, selectedNodeId === node.id && styles.nodeOptionSelected]}
                  onPress={() => {
                    setSelectedNodeId(node.id);
                    setShowNodeSelector(false);
                  }}
                >
                  <Text style={[styles.nodeOptionText, selectedNodeId === node.id && styles.nodeOptionTextSelected]}>
                    n/{node.slug} {node.name && `- ${node.name}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            placeholderTextColor="#94A3B8"
            multiline
            autoFocus
            value={content}
            onChangeText={setContent}
            maxLength={5000}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.node.bg,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.node.text,
  },
  cancelButton: {
    fontSize: 16,
    color: COLORS.node.muted,
  },
  postButton: {
    backgroundColor: COLORS.node.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: COLORS.node.muted,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  nodeSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
    position: "relative",
    zIndex: 10,
  },
  nodeSelectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
  },
  nodeSelectorText: {
    fontSize: 14,
    color: COLORS.node.text,
    fontWeight: "500",
  },
  nodeSelectorArrow: {
    fontSize: 12,
    color: COLORS.node.muted,
  },
  nodeSelectorDropdown: {
    position: "absolute",
    top: "100%",
    left: 16,
    right: 16,
    maxHeight: 200,
    backgroundColor: COLORS.node.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.node.border,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  nodeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.node.border,
  },
  nodeOptionSelected: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  nodeOptionText: {
    fontSize: 14,
    color: COLORS.node.text,
  },
  nodeOptionTextSelected: {
    color: COLORS.node.accent,
    fontWeight: "600",
  },
  inputContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 18,
    color: COLORS.node.text,
    lineHeight: 28,
    textAlignVertical: "top",
    height: "100%",
  },
});

