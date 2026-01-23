import { db } from "../db";
import { wallets, tokenTransactions, TokenTransactionKind } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface WalletInfo {
  userId: string;
  balanceTokens: number;
  lockedTokens: number;
  availableTokens: number;
  updatedAt: Date;
}

export interface TokenTransactionParams {
  userId: string;
  kind: TokenTransactionKind;
  amountTokens: number;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export async function getWallet(userId: string): Promise<WalletInfo | null> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId));

  if (!wallet) {
    return null;
  }

  return {
    userId: wallet.userId,
    balanceTokens: wallet.balanceTokens,
    lockedTokens: wallet.lockedTokens,
    availableTokens: wallet.balanceTokens - wallet.lockedTokens,
    updatedAt: wallet.updatedAt,
  };
}

export async function getOrCreateWallet(userId: string): Promise<WalletInfo> {
  let wallet = await getWallet(userId);
  
  if (!wallet) {
    await db
      .insert(wallets)
      .values({
        userId,
        balanceTokens: 0,
        lockedTokens: 0,
      })
      .onConflictDoNothing();
    
    wallet = await getWallet(userId);
    if (!wallet) {
      throw new Error("Failed to create wallet");
    }
  }
  
  return wallet;
}

export function getAvailableTokens(wallet: WalletInfo): number {
  return wallet.balanceTokens - wallet.lockedTokens;
}

export async function applyTokenTransaction(
  params: TokenTransactionParams
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  const { userId, kind, amountTokens, referenceType, referenceId, metadata } = params;

  try {
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for("update");

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const newBalance = wallet.balanceTokens + amountTokens;
      
      if (newBalance < 0) {
        throw new Error("Insufficient balance");
      }

      if (newBalance < wallet.lockedTokens) {
        throw new Error("Cannot reduce balance below locked amount");
      }

      await tx
        .update(wallets)
        .set({
          balanceTokens: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      await tx.insert(tokenTransactions).values({
        userId,
        kind,
        amountTokens,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        metadataJson: metadata || null,
      });

      return newBalance;
    });

    return { success: true, newBalance: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

export async function lockTokens(
  userId: string,
  amountTokens: number,
  kind: TokenTransactionKind,
  referenceType?: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (amountTokens <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  try {
    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for("update");

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const available = wallet.balanceTokens - wallet.lockedTokens;
      if (amountTokens > available) {
        throw new Error("Insufficient available tokens");
      }

      const newLocked = wallet.lockedTokens + amountTokens;

      await tx
        .update(wallets)
        .set({
          lockedTokens: newLocked,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      await tx.insert(tokenTransactions).values({
        userId,
        kind,
        amountTokens: 0,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        metadataJson: { ...metadata, action: "lock", lockedAmount: amountTokens } || null,
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lock failed",
    };
  }
}

export async function unlockTokens(
  userId: string,
  amountTokens: number,
  kind: TokenTransactionKind,
  referenceType?: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (amountTokens <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  try {
    await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for("update");

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      if (amountTokens > wallet.lockedTokens) {
        throw new Error("Cannot unlock more than locked amount");
      }

      const newLocked = wallet.lockedTokens - amountTokens;

      await tx
        .update(wallets)
        .set({
          lockedTokens: newLocked,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      await tx.insert(tokenTransactions).values({
        userId,
        kind,
        amountTokens: 0,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        metadataJson: { ...metadata, action: "unlock", unlockedAmount: amountTokens } || null,
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unlock failed",
    };
  }
}

export async function unlockAndDeductTokens(
  userId: string,
  amountTokens: number,
  kind: TokenTransactionKind,
  referenceType?: string,
  referenceId?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  if (amountTokens <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for("update");

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      if (amountTokens > wallet.lockedTokens) {
        throw new Error("Cannot deduct more than locked amount");
      }

      const newLocked = wallet.lockedTokens - amountTokens;
      const newBalance = wallet.balanceTokens - amountTokens;

      await tx
        .update(wallets)
        .set({
          balanceTokens: newBalance,
          lockedTokens: newLocked,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, userId));

      await tx.insert(tokenTransactions).values({
        userId,
        kind,
        amountTokens: -amountTokens,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        metadataJson: metadata || null,
      });

      return newBalance;
    });

    return { success: true, newBalance: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Deduction failed",
    };
  }
}

export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<typeof tokenTransactions.$inferSelect[]> {
  return db
    .select()
    .from(tokenTransactions)
    .where(eq(tokenTransactions.userId, userId))
    .orderBy(sql`${tokenTransactions.createdAt} DESC`)
    .limit(limit);
}
