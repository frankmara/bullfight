import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useChat, ChatMessage, ChatBadge } from "@/hooks/useChat";

interface ChatPanelProps {
  channelKind: "PVP_MATCH" | "COMPETITION";
  refId: string;
  enabled?: boolean;
  style?: any;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return date.toLocaleDateString();
}

function Badge({ badge }: { badge: ChatBadge }) {
  return (
    <View style={[styles.badge, { backgroundColor: badge.color }]}>
      <ThemedText style={styles.badgeText}>{badge.label}</ThemedText>
    </View>
  );
}

function MessageItem({
  message,
  badges,
}: {
  message: ChatMessage;
  badges: ChatBadge[];
}) {
  const isDeleted = !!message.deletedAt;
  const initial = message.username?.[0]?.toUpperCase() || "?";

  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{initial}</ThemedText>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <ThemedText style={styles.username}>{message.username}</ThemedText>
          {badges.map((b, i) => (
            <Badge key={i} badge={b} />
          ))}
          <ThemedText style={styles.timestamp}>
            {formatTimestamp(message.createdAt)}
          </ThemedText>
        </View>
        {isDeleted ? (
          <ThemedText style={styles.deletedText}>[message deleted]</ThemedText>
        ) : (
          <ThemedText style={styles.messageBody}>{message.body}</ThemedText>
        )}
      </View>
    </View>
  );
}

export function ChatPanel({ channelKind, refId, enabled = true, style }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const {
    messages,
    isConnected,
    isLoading,
    error,
    sendMessage,
    loadMore,
    hasMore,
    userBadges,
  } = useChat({ channelKind, refId, enabled });

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInputValue("");
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!enabled) {
    return (
      <View style={[styles.container, styles.disabled, style]}>
        <Feather name="message-circle" size={32} color={Colors.dark.textMuted} />
        <ThemedText style={styles.disabledText}>Chat is disabled</ThemedText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator color={Colors.dark.accent} />
        <ThemedText style={styles.loadingText}>Loading chat...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <Feather name="alert-circle" size={24} color={Colors.dark.danger} />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Feather name="message-circle" size={16} color={Colors.dark.accent} />
        <ThemedText style={styles.headerTitle}>Live Chat</ThemedText>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? Colors.dark.success : Colors.dark.danger },
          ]}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            badges={userBadges.get(item.userId) || []}
          />
        )}
        contentContainerStyle={styles.messageList}
        onStartReached={() => {
          if (hasMore) loadMore();
        }}
        onStartReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No messages yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>Be the first to chat!</ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Send a message..."
          placeholderTextColor={Colors.dark.textMuted}
          maxLength={280}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendButton, !inputValue.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputValue.trim()}
        >
          <Feather
            name="send"
            size={18}
            color={inputValue.trim() ? Colors.dark.accent : Colors.dark.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundElevated,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  disabledText: {
    color: Colors.dark.textMuted,
    marginTop: Spacing.md,
    fontSize: 14,
  },
  loadingText: {
    color: Colors.dark.textMuted,
    marginTop: Spacing.md,
    fontSize: 14,
  },
  errorText: {
    color: Colors.dark.danger,
    marginTop: Spacing.sm,
    fontSize: 12,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  messageList: {
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "700",
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  username: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginLeft: "auto",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
  },
  messageBody: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  deletedText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontStyle: "italic",
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: Spacing.xs,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.dark.text,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.backgroundRoot,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
