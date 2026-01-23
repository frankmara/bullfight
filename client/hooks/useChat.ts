import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "@bullfight_auth";

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface ChatBadge {
  type: "rank" | "winner" | "trader" | "mod" | "owner";
  label: string;
  color: string;
}

export interface ChatUser {
  id: string;
  username: string;
  badges: ChatBadge[];
  isMuted?: boolean;
}

interface UseChatOptions {
  channelKind: "PVP_MATCH" | "COMPETITION";
  refId: string;
  enabled?: boolean;
}

interface UseChatResult {
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  sendMessage: (body: string) => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  userBadges: Map<string, ChatBadge[]>;
}

export function useChat({ channelKind, refId, enabled = true }: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [userBadges, setUserBadges] = useState<Map<string, ChatBadge[]>>(new Map());
  
  const socketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const initializeChat = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          userIdRef.current = user.id;
        }

        const baseUrl = getApiUrl();
        const channelRes = await fetch(
          `${baseUrl}api/chat/channel?kind=${channelKind}&refId=${refId}`
        );
        if (!channelRes.ok) throw new Error("Failed to get chat channel");
        const channelData = await channelRes.json();
        setChannelId(channelData.channelId);

        const messagesRes = await fetch(
          `${baseUrl}api/chat/messages?channelId=${channelData.channelId}`
        );
        if (!messagesRes.ok) throw new Error("Failed to load messages");
        const messagesData = await messagesRes.json();
        setMessages(messagesData.messages.reverse());
        setNextCursor(messagesData.nextCursor);
        setHasMore(!!messagesData.nextCursor);

        const badgesRes = await fetch(
          `${baseUrl}api/chat/badges?kind=${channelKind}&refId=${refId}`
        );
        if (badgesRes.ok) {
          const badgesData = await badgesRes.json();
          setUserBadges(new Map(Object.entries(badgesData.badges || {})));
        }

        const socketUrl = baseUrl.replace(/\/$/, "");
        const socket = io(`${socketUrl}/chat`, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          setIsConnected(true);
          setError(null);
          socket.emit("joinChannel", {
            channelId: channelData.channelId,
            userId: userIdRef.current,
          });
        });

        socket.on("disconnect", () => {
          setIsConnected(false);
        });

        socket.on("connect_error", (err) => {
          setError(`Connection error: ${err.message}`);
          setIsConnected(false);
        });

        socket.on("newMessage", (message: ChatMessage) => {
          setMessages((prev) => [...prev, message]);
        });

        socket.on("messageDeleted", ({ messageId }: { messageId: string }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m
            )
          );
        });

        socket.on("error", ({ message }: { message: string }) => {
          setError(message);
        });

        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    initializeChat();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [channelKind, refId, enabled]);

  const sendMessage = useCallback(
    (body: string) => {
      if (!socketRef.current || !channelId || !userIdRef.current) return;
      socketRef.current.emit("messageSend", {
        channelId,
        userId: userIdRef.current,
        body,
      });
    },
    [channelId]
  );

  const loadMore = useCallback(async () => {
    if (!channelId || !nextCursor || !hasMore) return;

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(
        `${baseUrl}api/chat/messages?channelId=${channelId}&cursor=${nextCursor}`
      );
      if (!res.ok) throw new Error("Failed to load more messages");
      const data = await res.json();
      setMessages((prev) => [...data.messages.reverse(), ...prev]);
      setNextCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err: any) {
      setError(err.message);
    }
  }, [channelId, nextCursor, hasMore]);

  return {
    messages,
    isConnected,
    isLoading,
    error,
    sendMessage,
    loadMore,
    hasMore,
    userBadges,
  };
}
