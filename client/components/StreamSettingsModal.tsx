import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type StreamEmbedType = "none" | "twitch" | "youtube" | "url";

interface StreamSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  currentStreamType?: StreamEmbedType;
  currentStreamUrl?: string | null;
}

export function StreamSettingsModal({
  visible,
  onClose,
  matchId,
  currentStreamType = "none",
  currentStreamUrl = null,
}: StreamSettingsModalProps) {
  const [streamType, setStreamType] = useState<StreamEmbedType>(currentStreamType);
  const [streamUrl, setStreamUrl] = useState(currentStreamUrl || "");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setStreamType(currentStreamType);
    setStreamUrl(currentStreamUrl || "");
    setError(null);
  }, [currentStreamType, currentStreamUrl, visible]);

  const updateStreamMutation = useMutation({
    mutationFn: async (data: { streamEmbedType: StreamEmbedType; streamUrl?: string }) => {
      return apiRequest("PUT", `/api/pvp/challenges/${matchId}/stream`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watch/pvp/${matchId}`] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update stream settings");
    },
  });

  const handleSave = () => {
    setError(null);
    
    if (streamType !== "none" && !streamUrl.trim()) {
      setError("Please enter a stream URL");
      return;
    }

    updateStreamMutation.mutate({
      streamEmbedType: streamType,
      streamUrl: streamType === "none" ? undefined : streamUrl.trim(),
    });
  };

  const streamTypeOptions: { type: StreamEmbedType; label: string; icon: string }[] = [
    { type: "none", label: "No Stream", icon: "video-off" },
    { type: "twitch", label: "Twitch", icon: "twitch" },
    { type: "youtube", label: "YouTube", icon: "youtube" },
    { type: "url", label: "Custom URL", icon: "link" },
  ];

  const getPlaceholder = () => {
    switch (streamType) {
      case "twitch":
        return "https://twitch.tv/channel_name";
      case "youtube":
        return "https://youtube.com/watch?v=...";
      case "url":
        return "https://example.com/embed/...";
      default:
        return "";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Stream Settings</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={Colors.dark.text} />
            </Pressable>
          </View>

          <ThemedText style={styles.label}>Stream Type</ThemedText>
          <View style={styles.typeGrid}>
            {streamTypeOptions.map((option) => (
              <Pressable
                key={option.type}
                style={[
                  styles.typeOption,
                  streamType === option.type && styles.typeOptionSelected,
                ]}
                onPress={() => setStreamType(option.type)}
              >
                <Feather
                  name={option.icon as keyof typeof Feather.glyphMap}
                  size={20}
                  color={
                    streamType === option.type
                      ? Colors.dark.accent
                      : Colors.dark.textMuted
                  }
                />
                <ThemedText
                  style={[
                    styles.typeLabel,
                    streamType === option.type && styles.typeLabelSelected,
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {streamType !== "none" ? (
            <>
              <ThemedText style={styles.label}>Stream URL</ThemedText>
              <TextInput
                style={styles.input}
                value={streamUrl}
                onChangeText={setStreamUrl}
                placeholder={getPlaceholder()}
                placeholderTextColor={Colors.dark.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <ThemedText style={styles.hint}>
                {streamType === "twitch"
                  ? "Enter your Twitch channel URL or embed URL"
                  : streamType === "youtube"
                  ? "Enter your YouTube video or live stream URL"
                  : "Enter an embed URL from a supported provider (Vimeo, Kick, etc.)"}
              </ThemedText>
            </>
          ) : null}

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color={Colors.dark.danger} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                updateStreamMutation.isPending && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={updateStreamMutation.isPending}
            >
              {updateStreamMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.dark.backgroundDefault} />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeOptionSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: `${Colors.dark.accent}20`,
  },
  typeLabel: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  typeLabelSelected: {
    color: Colors.dark.accent,
    fontWeight: "600",
  },
  input: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.dark.text,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  hint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.lg,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: `${Colors.dark.danger}20`,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.dark.danger,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.accent,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    color: Colors.dark.backgroundDefault,
    fontWeight: "700",
  },
});
