import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface StreamEmbedProps {
  streamEmbedType: "none" | "twitch" | "youtube" | "url";
  streamUrl: string | null;
  style?: object;
}

export function StreamEmbed({ streamEmbedType, streamUrl, style }: StreamEmbedProps) {
  if (streamEmbedType === "none" || !streamUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <View style={styles.placeholderContent}>
          <Feather name="video" size={48} color={Colors.dark.textMuted} />
          <ThemedText style={styles.placeholderTitle}>Stream Starting Soon</ThemedText>
          <ThemedText style={styles.placeholderText}>
            The trader hasn't configured a stream yet
          </ThemedText>
        </View>
      </View>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.placeholder, style]}>
        <View style={styles.placeholderContent}>
          <Feather name="monitor" size={48} color={Colors.dark.textMuted} />
          <ThemedText style={styles.placeholderTitle}>Stream Available on Web</ThemedText>
          <ThemedText style={styles.placeholderText}>
            View this match on the web to watch the stream
          </ThemedText>
        </View>
      </View>
    );
  }

  const embedUrl = getEmbedUrl(streamEmbedType, streamUrl);

  if (!embedUrl) {
    return (
      <View style={[styles.placeholder, style]}>
        <View style={styles.placeholderContent}>
          <Feather name="alert-circle" size={48} color={Colors.dark.danger} />
          <ThemedText style={styles.placeholderTitle}>Invalid Stream</ThemedText>
          <ThemedText style={styles.placeholderText}>
            The stream configuration is invalid
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.embedContainer, style]}>
      <iframe
        src={embedUrl}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: BorderRadius.lg,
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      />
    </View>
  );
}

function getEmbedUrl(type: string, url: string): string | null {
  try {
    switch (type) {
      case "twitch": {
        const channel = url.replace(/[^a-zA-Z0-9_]/g, "");
        if (!channel) return null;
        const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
      }
      case "youtube": {
        const videoId = url.replace(/[^a-zA-Z0-9_-]/g, "");
        if (!videoId || videoId.length !== 11) return null;
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
      }
      case "url": {
        if (!isWhitelistedUrl(url)) return null;
        return url;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function isWhitelistedUrl(url: string): boolean {
  const allowedDomains = [
    "player.twitch.tv",
    "www.youtube.com",
    "youtube.com",
    "www.twitch.tv",
    "twitch.tv",
    "vimeo.com",
    "player.vimeo.com",
    "kick.com",
  ];

  try {
    const parsed = new URL(url);
    return allowedDomains.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 300,
  },
  placeholderContent: {
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
    textAlign: "center",
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  embedContainer: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    minHeight: 300,
  },
});
