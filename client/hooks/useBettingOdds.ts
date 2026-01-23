import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "@/lib/query-client";

export interface OddsUpdate {
  matchId: string;
  poolA: number;
  poolB: number;
  projMultA: number | null;
  projMultB: number | null;
  pWinA: number;
  pWinB: number;
  challengerId: string;
  inviteeId: string;
  timeRemainingPct: number;
}

interface UseBettingOddsOptions {
  matchId: string;
  enabled?: boolean;
}

interface UseBettingOddsResult {
  odds: OddsUpdate | null;
  isConnected: boolean;
}

export function useBettingOdds({ matchId, enabled = true }: UseBettingOddsOptions): UseBettingOddsResult {
  const [odds, setOdds] = useState<OddsUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentMatchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !matchId) {
      return;
    }

    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, "ws").replace(/:5000$/, ":5000");

    socketRef.current = io(`${wsUrl}/betting`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
      if (matchId) {
        socket.emit("joinMarket", { matchId });
        currentMatchRef.current = matchId;
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("betting:update", (data: OddsUpdate) => {
      if (data.matchId === matchId) {
        setOdds(data);
      }
    });

    return () => {
      if (currentMatchRef.current) {
        socket.emit("leaveMarket", { matchId: currentMatchRef.current });
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
      socket.emit("leaveMarket", { matchId: currentMatchRef.current });
    }

    if (matchId) {
      socket.emit("joinMarket", { matchId });
      currentMatchRef.current = matchId;
    }
  }, [matchId, isConnected]);

  return { odds, isConnected };
}
