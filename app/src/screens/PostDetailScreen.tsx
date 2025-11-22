import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPost, getComments, createComment, Post, Comment } from "../lib/api";
import { PostCard } from "../components/PostCard";

type PostDetailScreenProps = {
  postId: string;
  onBack: () => void;
};

export const PostDetailScreen = ({ postId, onBack }: PostDetailScreenProps) => {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const [postData, commentsData] = await Promise.all([
        getPost(postId),
        getComments(postId),
      ]);
      setPost(postData);
      setComments(commentsData);
    } catch (err) {
      console.error("Failed to load post detail:", err);
      setError("Failed to load post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [postId]);

  const handleSendComment = async () => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      const newComment = await createComment(postId, { content: replyText.trim() });
      setComments((prev) => [newComment, ...prev]);
      setReplyText("");
      
      // Update post comment count locally
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    // Calculate indentation level (for future: support nested replies)
    const isReply = !!item.parentId;
    const indentLevel = isReply ? 1 : 0;

    return (
      <View style={[styles.commentCard, indentLevel > 0 && styles.commentReply]}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{item.author.email.split("@")[0]}</Text>
          {item.replyCount > 0 && (
            <Text style={styles.replyCountText}>{item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}</Text>
          )}
        </View>
        <Text style={styles.commentContent}>{item.content}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 60 }} /> 
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={styles.keyboardView}
      >
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.postContainer}>
              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                  <TouchableOpacity onPress={loadData}>
                    <Text style={styles.errorBannerRetry}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              <PostCard post={post} />
              <Text style={styles.commentsTitle}>
                Comments {comments.length > 0 && `(${comments.length})`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment..."
            placeholderTextColor="#94A3B8"
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!replyText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  backButton: {
    width: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: "#2563EB",
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  postContainer: {
    marginBottom: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  commentCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  commentReply: {
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#E2E8F0",
    paddingLeft: 12,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: {
    fontWeight: "600",
    fontSize: 14,
    color: "#334155",
  },
  replyCountText: {
    fontSize: 12,
    color: "#64748B",
  },
  commentContent: {
    fontSize: 15,
    color: "#1E293B",
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorBannerText: {
    color: "#991B1B",
    fontSize: 14,
    flex: 1,
  },
  errorBannerRetry: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1E293B",
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});

