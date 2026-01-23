import { Server, Namespace, Socket } from "socket.io";

interface ViewerInfo {
  socketId: string;
  userId?: string;
  joinedAt: number;
}

class PresenceService {
  private io: Server | null = null;
  private presenceNamespace: Namespace | null = null;
  private matchViewers: Map<string, Map<string, ViewerInfo>> = new Map();

  initialize(io: Server): void {
    this.io = io;
    this.presenceNamespace = this.io.of("/presence");
    this.setupEventHandlers();
    console.log("PresenceService initialized with Socket.io /presence namespace");
  }

  private setupEventHandlers(): void {
    if (!this.presenceNamespace) return;

    this.presenceNamespace.on("connection", (socket: Socket) => {
      const userId = socket.handshake.auth?.userId;

      socket.on("joinWatch", (data: { matchId: string }) => {
        const { matchId } = data;
        if (!matchId) return;

        socket.join(`match:${matchId}`);

        if (!this.matchViewers.has(matchId)) {
          this.matchViewers.set(matchId, new Map());
        }

        const viewers = this.matchViewers.get(matchId)!;
        viewers.set(socket.id, {
          socketId: socket.id,
          userId,
          joinedAt: Date.now(),
        });

        this.broadcastViewerCount(matchId);
      });

      socket.on("leaveWatch", (data: { matchId: string }) => {
        const { matchId } = data;
        if (!matchId) return;

        socket.leave(`match:${matchId}`);

        const viewers = this.matchViewers.get(matchId);
        if (viewers) {
          viewers.delete(socket.id);
          if (viewers.size === 0) {
            this.matchViewers.delete(matchId);
          }
        }

        this.broadcastViewerCount(matchId);
      });

      socket.on("disconnect", () => {
        for (const [matchId, viewers] of this.matchViewers.entries()) {
          if (viewers.has(socket.id)) {
            viewers.delete(socket.id);
            if (viewers.size === 0) {
              this.matchViewers.delete(matchId);
            }
            this.broadcastViewerCount(matchId);
          }
        }
      });
    });
  }

  private broadcastViewerCount(matchId: string): void {
    if (!this.presenceNamespace) return;

    const viewers = this.matchViewers.get(matchId);
    const count = viewers?.size || 0;

    this.presenceNamespace.to(`match:${matchId}`).emit("viewersCount", {
      matchId,
      count,
    });
  }

  getViewerCount(matchId: string): number {
    const viewers = this.matchViewers.get(matchId);
    return viewers?.size || 0;
  }

  getAllViewerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [matchId, viewers] of this.matchViewers.entries()) {
      counts[matchId] = viewers.size;
    }
    return counts;
  }

  notifyLiveStatusChange(matchId: string, status: string): void {
    if (!this.presenceNamespace) return;

    this.presenceNamespace.to(`match:${matchId}`).emit("liveStatusChanged", {
      matchId,
      status,
    });

    this.io?.of("/").emit("matchLiveStatusChanged", {
      matchId,
      status,
      viewerCount: this.getViewerCount(matchId),
    });
  }
}

export const presenceService = new PresenceService();
