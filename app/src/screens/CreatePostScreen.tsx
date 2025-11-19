import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { createPost } from "../lib/api";

type CreatePostScreenProps = {
  onSuccess: () => void;
  onCancel: () => void;
  nodeId?: string; // Optional: post to specific node
};

export const CreatePostScreen = ({ onSuccess, onCancel, nodeId }: CreatePostScreenProps) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setLoading(true);
    try {
      await createPost({
        content: content.trim(),
        nodeId,
      });
      onSuccess();
    } catch (error) {
      Alert.alert("Error", "Failed to create post. Please try again.");
      setLoading(false);
    }
  };

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
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  cancelButton: {
    fontSize: 16,
    color: "#64748B",
  },
  postButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  inputContainer: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 18,
    color: "#1E293B",
    lineHeight: 28,
    textAlignVertical: "top",
    height: "100%",
  },
});

