import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/query-client";

interface UsePresenceOptions {
  matchId: string;
  enabled?: boolean;
}

interface UsePresenceResult {
  viewerCount: number;
  isConnected: boolean;
  liveStatus: string | null;
}

export function usePresence({ matchId, enabled = true }: UsePresenceOptions): UsePresenceResult {
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentMatchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !matchId) {
      return;
    }

    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, "ws").replace(/:5000$/, ":5000");

    socketRef.current = io(`${wsUrl}/presence`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
      if (matchId) {
        socket.emit("joinWatch", { matchId });
        currentMatchRef.current = matchId;
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("viewersCount", (data: { matchId: string; count: number }) => {
      if (data.matchId === matchId) {
        setViewerCount(data.count);
      }
    });

    socket.on("liveStatusChanged", (data: { matchId: string; status: string }) => {
      if (data.matchId === matchId) {
        setLiveStatus(data.status);
      }
    });

    return () => {
      if (currentMatchRef.current) {
        socket.emit("leaveWatch", { matchId: currentMatchRef.current });
      }
      socket.disconnect();
      socketRef.current = null;
      currentMatchRef.current = null;
    };
  }, [matchId, enabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    if (currentMatchRef.current && currentMatchRef.current !== matchId) {
      socket.emit("leaveWatch", { matchId: currentMatchRef.current });
    }

    if (matchId) {
      socket.emit("joinWatch", { matchId });
      currentMatchRef.current = matchId;
    }
  }, [matchId, isConnected]);

  return {
    viewerCount,
    isConnected,
    liveStatus,
  };
}

export function useViewerCounts(): {
  viewerCounts: Record<string, number>;
  isConnected: boolean;
  refetch: () => void;
} {
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/pvp/viewer-counts`);
      if (response.ok) {
        const data = await response.json();
        setViewerCounts(data.viewerCounts || {});
      }
    } catch (error) {
      console.error("Failed to fetch viewer counts:", error);
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, "ws").replace(/:5000$/, ":5000");

    socketRef.current = io(wsUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("matchLiveStatusChanged", (data: { matchId: string; viewerCount: number }) => {
      setViewerCounts((prev) => ({
        ...prev,
        [data.matchId]: data.viewerCount,
      }));
    });

    const interval = setInterval(fetchCounts, 10000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchCounts]);

  return {
    viewerCounts,
    isConnected,
    refetch: fetchCounts,
  };
}
