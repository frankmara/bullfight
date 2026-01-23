import { Server as HttpServer } from "http";
import { Server, Socket, Namespace } from "socket.io";
import { db } from "../db";
import { 
  chatChannels, 
  chatMessages, 
  chatMembers, 
  chatReports,
  users,
  ChatChannel,
  ChatMessage,
  ChatMember 
} from "../../shared/schema";
import { eq, and, desc, lt, isNull, sql } from "drizzle-orm";

// Simple profanity filter word list (MVP)
const PROFANITY_LIST = [
  "fuck", "shit", "ass", "bitch", "damn", "crap", "bastard", 
  "dick", "cock", "pussy", "cunt", "fag", "retard", "nigger",
  "slut", "whore", "piss", "douche"
];

// Rate limit: 1 message per 800ms per user per channel
const RATE_LIMIT_MS = 800;
const MAX_MESSAGE_LENGTH = 280;
const MAX_MESSAGE_LENGTH_PREMIUM = 500;

// Track rate limits in memory
const rateLimits = new Map<string, number>();

function getRateLimitKey(userId: string, channelId: string): string {
  return `${userId}:${channelId}`;
}

function checkRateLimit(userId: string, channelId: string): boolean {
  const key = getRateLimitKey(userId, channelId);
  const now = Date.now();
  const lastMessage = rateLimits.get(key) || 0;
  
  if (now - lastMessage < RATE_LIMIT_MS) {
    return false;
  }
  
  rateLimits.set(key, now);
  return true;
}

function filterProfanity(text: string): string {
  let filtered = text;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  }
  return filtered;
}

function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(lowerText);
  });
}

export interface ChatUser {
  id: string;
  username: string;
  role: string;
}

interface SocketData {
  userId: string;
  username: string;
  channels: Set<string>;
}

class ChatService {
  private io: Server | null = null;
  private chatNamespace: Namespace | null = null;
  private connectedUsers = new Map<string, Socket>();

  initialize(server: HttpServer): void {
    this.io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          // Allow Replit domains and localhost
          if (!origin) {
            callback(null, true);
            return;
          }
          
          const isAllowed = 
            origin.includes("replit") ||
            origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:");
          
          callback(null, isAllowed);
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.chatNamespace = this.io.of("/chat");
    this.setupEventHandlers();
    console.log("ChatService initialized with Socket.io /chat namespace");
  }

  getIo(): Server | null {
    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.chatNamespace) return;

    this.chatNamespace.on("connection", (socket: Socket) => {
      console.log(`Chat client connected: ${socket.id}`);
      
      const socketData: SocketData = {
        userId: "",
        username: "",
        channels: new Set(),
      };

      // Authenticate user
      socket.on("authenticate", async (data: { userId: string }) => {
        try {
          const user = await this.getUser(data.userId);
          if (user) {
            socketData.userId = user.id;
            socketData.username = user.username || user.email?.split("@")[0] || "Anonymous";
            this.connectedUsers.set(user.id, socket);
            socket.emit("authenticated", { 
              success: true, 
              userId: user.id, 
              username: socketData.username 
            });
          } else {
            socket.emit("authenticated", { success: false, error: "User not found" });
          }
        } catch (error) {
          socket.emit("authenticated", { success: false, error: "Authentication failed" });
        }
      });

      // Join channel
      socket.on("joinChannel", async (data: { channelId: string }) => {
        try {
          if (!socketData.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          const channel = await this.getChannel(data.channelId);
          if (!channel) {
            socket.emit("error", { message: "Channel not found" });
            return;
          }

          // Join the socket room
          socket.join(data.channelId);
          socketData.channels.add(data.channelId);

          // Add/update member in database
          await this.addMember(data.channelId, socketData.userId);

          // Notify others
          socket.to(data.channelId).emit("userJoined", {
            userId: socketData.userId,
            username: socketData.username,
          });

          socket.emit("channelJoined", { channelId: data.channelId });
        } catch (error) {
          console.error("Join channel error:", error);
          socket.emit("error", { message: "Failed to join channel" });
        }
      });

      // Leave channel
      socket.on("leaveChannel", (data: { channelId: string }) => {
        socket.leave(data.channelId);
        socketData.channels.delete(data.channelId);
        
        socket.to(data.channelId).emit("userLeft", {
          userId: socketData.userId,
          username: socketData.username,
        });
      });

      // Send message
      socket.on("messageSend", async (data: { channelId: string; body: string }) => {
        try {
          if (!socketData.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          const { channelId, body } = data;

          // Validate message length
          if (!body || body.trim().length === 0) {
            socket.emit("error", { message: "Message cannot be empty" });
            return;
          }

          if (body.length > MAX_MESSAGE_LENGTH_PREMIUM) {
            socket.emit("error", { message: `Message too long (max ${MAX_MESSAGE_LENGTH_PREMIUM} chars)` });
            return;
          }

          // Check rate limit
          if (!checkRateLimit(socketData.userId, channelId)) {
            socket.emit("error", { message: "Slow down! You're sending messages too fast" });
            return;
          }

          // Check if user is muted
          const member = await this.getMember(channelId, socketData.userId);
          if (member?.mutedUntil && new Date(member.mutedUntil) > new Date()) {
            const remaining = Math.ceil((new Date(member.mutedUntil).getTime() - Date.now()) / 1000);
            socket.emit("error", { message: `You are muted for ${remaining} more seconds` });
            return;
          }

          // Filter profanity
          const filteredBody = filterProfanity(body.trim());

          // Save message to database
          const message = await this.createMessage(channelId, socketData.userId, filteredBody);

          // Broadcast to all users in channel
          const messagePayload = {
            id: message.id,
            channelId: message.channelId,
            userId: message.userId,
            username: socketData.username,
            body: message.body,
            createdAt: message.createdAt,
          };

          this.chatNamespace?.to(channelId).emit("messageNew", messagePayload);
        } catch (error) {
          console.error("Send message error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      });

      // Delete message (mod/admin only)
      socket.on("messageDelete", async (data: { messageId: string }) => {
        try {
          if (!socketData.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          const message = await this.getMessage(data.messageId);
          if (!message) {
            socket.emit("error", { message: "Message not found" });
            return;
          }

          // Check if user is mod/owner or admin
          const member = await this.getMember(message.channelId, socketData.userId);
          const user = await this.getUser(socketData.userId);
          
          const canDelete = 
            message.userId === socketData.userId || // Own message
            member?.role === "MOD" || 
            member?.role === "OWNER" ||
            user?.role === "admin";

          if (!canDelete) {
            socket.emit("error", { message: "Not authorized to delete this message" });
            return;
          }

          // Soft delete message
          await this.deleteMessage(data.messageId);

          // Broadcast deletion
          this.chatNamespace?.to(message.channelId).emit("messageDelete", {
            messageId: data.messageId,
          });
        } catch (error) {
          console.error("Delete message error:", error);
          socket.emit("error", { message: "Failed to delete message" });
        }
      });

      // Mute user (mod/admin only)
      socket.on("muteUser", async (data: { channelId: string; userId: string; durationSeconds: number }) => {
        try {
          if (!socketData.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          // Check if requester is mod/owner
          const requesterMember = await this.getMember(data.channelId, socketData.userId);
          const requesterUser = await this.getUser(socketData.userId);
          
          const canMute = 
            requesterMember?.role === "MOD" || 
            requesterMember?.role === "OWNER" ||
            requesterUser?.role === "admin";

          if (!canMute) {
            socket.emit("error", { message: "Not authorized to mute users" });
            return;
          }

          // Mute the user
          const mutedUntil = new Date(Date.now() + data.durationSeconds * 1000);
          await this.muteUser(data.channelId, data.userId, mutedUntil);

          // Notify channel
          this.chatNamespace?.to(data.channelId).emit("userMuted", {
            userId: data.userId,
            until: mutedUntil.toISOString(),
          });
        } catch (error) {
          console.error("Mute user error:", error);
          socket.emit("error", { message: "Failed to mute user" });
        }
      });

      // Report message
      socket.on("reportMessage", async (data: { messageId: string; reason: string }) => {
        try {
          if (!socketData.userId) {
            socket.emit("error", { message: "Not authenticated" });
            return;
          }

          await this.createReport(data.messageId, socketData.userId, data.reason);
          socket.emit("reportSubmitted", { success: true });
        } catch (error) {
          console.error("Report message error:", error);
          socket.emit("error", { message: "Failed to submit report" });
        }
      });

      // Disconnect
      socket.on("disconnect", () => {
        console.log(`Chat client disconnected: ${socket.id}`);
        if (socketData.userId) {
          this.connectedUsers.delete(socketData.userId);
        }
        
        // Notify channels of user leaving
        socketData.channels.forEach((channelId) => {
          socket.to(channelId).emit("userLeft", {
            userId: socketData.userId,
            username: socketData.username,
          });
        });
      });
    });
  }

  // Database operations
  private async getUser(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }

  private async getChannel(channelId: string) {
    const [channel] = await db
      .select()
      .from(chatChannels)
      .where(eq(chatChannels.id, channelId));
    return channel;
  }

  async getOrCreateChannel(kind: string, refId: string): Promise<ChatChannel> {
    // Check if channel exists
    const [existing] = await db
      .select()
      .from(chatChannels)
      .where(and(
        eq(chatChannels.kind, kind),
        eq(chatChannels.refId, refId)
      ));

    if (existing) {
      return existing;
    }

    // Create new channel
    const [channel] = await db
      .insert(chatChannels)
      .values({ kind, refId })
      .returning();

    return channel;
  }

  private async getMember(channelId: string, userId: string): Promise<ChatMember | null> {
    const [member] = await db
      .select()
      .from(chatMembers)
      .where(and(
        eq(chatMembers.channelId, channelId),
        eq(chatMembers.userId, userId)
      ));
    return member || null;
  }

  private async addMember(channelId: string, userId: string, role: string = "MEMBER"): Promise<void> {
    const existing = await this.getMember(channelId, userId);
    if (!existing) {
      await db.insert(chatMembers).values({
        channelId,
        userId,
        role,
      });
    }
  }

  private async muteUser(channelId: string, userId: string, until: Date): Promise<void> {
    const existing = await this.getMember(channelId, userId);
    if (existing) {
      await db
        .update(chatMembers)
        .set({ mutedUntil: until })
        .where(eq(chatMembers.id, existing.id));
    } else {
      await db.insert(chatMembers).values({
        channelId,
        userId,
        role: "MEMBER",
        mutedUntil: until,
      });
    }
  }

  private async getMessage(messageId: string): Promise<ChatMessage | null> {
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));
    return message || null;
  }

  private async createMessage(channelId: string, userId: string, body: string): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({ channelId, userId, body })
      .returning();
    return message;
  }

  private async deleteMessage(messageId: string): Promise<void> {
    await db
      .update(chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessages.id, messageId));
  }

  async getMessages(channelId: string, cursor?: string, limit: number = 50): Promise<{
    messages: any[];
    nextCursor: string | null;
  }> {
    let query = db
      .select({
        id: chatMessages.id,
        channelId: chatMessages.channelId,
        userId: chatMessages.userId,
        username: users.username,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        deletedAt: chatMessages.deletedAt,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(and(
        eq(chatMessages.channelId, channelId),
        isNull(chatMessages.deletedAt)
      ))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      query = db
        .select({
          id: chatMessages.id,
          channelId: chatMessages.channelId,
          userId: chatMessages.userId,
          username: users.username,
          body: chatMessages.body,
          createdAt: chatMessages.createdAt,
          deletedAt: chatMessages.deletedAt,
        })
        .from(chatMessages)
        .leftJoin(users, eq(chatMessages.userId, users.id))
        .where(and(
          eq(chatMessages.channelId, channelId),
          isNull(chatMessages.deletedAt),
          lt(chatMessages.createdAt, cursorDate)
        ))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit + 1);
    }

    const results = await query;
    const hasMore = results.length > limit;
    const messages = hasMore ? results.slice(0, limit) : results;
    
    return {
      messages: messages.map(m => ({
        ...m,
        username: m.username || "Anonymous",
      })),
      nextCursor: hasMore && messages.length > 0 
        ? messages[messages.length - 1].createdAt.toISOString() 
        : null,
    };
  }

  private async createReport(messageId: string, reporterId: string, reason: string): Promise<void> {
    await db.insert(chatReports).values({
      messageId,
      reporterId,
      reason,
    });
  }

  // Get channel by kind and refId
  async findChannel(kind: string, refId: string): Promise<ChatChannel | null> {
    const [channel] = await db
      .select()
      .from(chatChannels)
      .where(and(
        eq(chatChannels.kind, kind),
        eq(chatChannels.refId, refId)
      ));
    return channel || null;
  }

  // Get all members of a channel
  async getChannelMembers(channelId: string): Promise<Array<{ userId: string; role: string }>> {
    const members = await db
      .select({
        userId: chatMembers.userId,
        role: chatMembers.role,
      })
      .from(chatMembers)
      .where(eq(chatMembers.channelId, channelId));
    
    return members;
  }
}

export const chatService = new ChatService();
