import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  usernameChangedAt: timestamp("username_changed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitions = pgTable("competitions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("public"),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  theme: text("theme"),
  description: text("description"),
  buyInCents: integer("buy_in_cents").notNull().default(10000),
  entryCap: integer("entry_cap").notNull().default(1000),
  rakeBps: integer("rake_bps").notNull().default(3000),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  startingBalanceCents: integer("starting_balance_cents")
    .notNull()
    .default(10000000),
  allowedPairsJson: jsonb("allowed_pairs_json")
    .$type<string[]>()
    .default(["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"]),
  prizeSplitsJson: jsonb("prize_splits_json")
    .$type<number[]>()
    .default([60, 30, 10]),
  spreadMarkupPips: real("spread_markup_pips").notNull().default(0.5),
  maxSlippagePips: real("max_slippage_pips").notNull().default(1.0),
  minOrderIntervalMs: integer("min_order_interval_ms").notNull().default(1000),
  maxDrawdownPct: real("max_drawdown_pct"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitionEntries = pgTable("competition_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("pending"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  cashCents: integer("cash_cents").notNull().default(10000000),
  equityCents: integer("equity_cents").notNull().default(10000000),
  maxEquityCents: integer("max_equity_cents").notNull().default(10000000),
  maxDrawdownPct: real("max_drawdown_pct").notNull().default(0),
  dq: boolean("dq").notNull().default(false),
  lastOrderAt: timestamp("last_order_at"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentId: text("stripe_payment_id"),
});

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  pair: text("pair").notNull(),
  side: text("side").notNull(),
  type: text("type").notNull(),
  quantityUnits: integer("quantity_units").notNull(),
  limitPrice: real("limit_price"),
  stopPrice: real("stop_price"),
  trailingStopPips: real("trailing_stop_pips"),
  takeProfitPrice: real("take_profit_price"),
  stopLossPrice: real("stop_loss_price"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fills = pgTable("fills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  pair: text("pair").notNull(),
  side: text("side").notNull(),
  quantityUnits: integer("quantity_units").notNull(),
  price: real("price").notNull(),
  feeCents: integer("fee_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const positions = pgTable("positions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  pair: text("pair").notNull(),
  side: text("side").notNull(),
  quantityUnits: integer("quantity_units").notNull(),
  avgEntryPrice: real("avg_entry_price").notNull(),
  stopLossPrice: real("stop_loss_price"),
  takeProfitPrice: real("take_profit_price"),
  openAt: timestamp("open_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  realizedPnlCents: integer("realized_pnl_cents").notNull().default(0),
});

export const trades = pgTable("trades", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  pair: text("pair").notNull(),
  sideInitial: text("side_initial").notNull(),
  totalInUnits: integer("total_in_units").notNull().default(0),
  totalOutUnits: integer("total_out_units").notNull().default(0),
  avgEntryPrice: real("avg_entry_price").notNull(),
  avgExitPrice: real("avg_exit_price"),
  realizedPnlCents: integer("realized_pnl_cents").notNull().default(0),
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const deals = pgTable("deals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id")
    .references(() => trades.id)
    .notNull(),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  pair: text("pair").notNull(),
  side: text("side").notNull(),
  units: integer("units").notNull(),
  lots: real("lots").notNull(),
  price: real("price").notNull(),
  kind: text("kind").notNull(),
  realizedPnlCents: integer("realized_pnl_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payouts = pgTable("payouts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  competitionId: varchar("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  place: integer("place").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pvpChallenges = pgTable("pvp_challenges", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name"),
  challengerId: varchar("challenger_id")
    .references(() => users.id)
    .notNull(),
  inviteeId: varchar("invitee_id").references(() => users.id),
  inviteeEmail: text("invitee_email"),
  status: text("status").notNull().default("draft"),
  stakeCents: integer("stake_cents").notNull().default(1000),
  startingBalanceCents: integer("starting_balance_cents").notNull().default(10000000),
  allowedPairsJson: jsonb("allowed_pairs_json")
    .$type<string[]>()
    .default(["EUR-USD", "GBP-USD", "USD-JPY", "AUD-USD", "USD-CAD"]),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  spreadMarkupPips: real("spread_markup_pips").notNull().default(0.5),
  maxSlippagePips: real("max_slippage_pips").notNull().default(1.0),
  minOrderIntervalMs: integer("min_order_interval_ms").notNull().default(1000),
  maxDrawdownPct: real("max_drawdown_pct"),
  rakeBps: integer("rake_bps").notNull().default(300),
  proposedTermsJson: jsonb("proposed_terms_json"),
  proposedBy: varchar("proposed_by").references(() => users.id),
  challengerAccepted: boolean("challenger_accepted").notNull().default(false),
  inviteeAccepted: boolean("invitee_accepted").notNull().default(false),
  challengerPaid: boolean("challenger_paid").notNull().default(false),
  inviteePaid: boolean("invitee_paid").notNull().default(false),
  challengerStripeSessionId: text("challenger_stripe_session_id"),
  challengerStripePaymentId: text("challenger_stripe_payment_id"),
  inviteeStripeSessionId: text("invitee_stripe_session_id"),
  inviteeStripePaymentId: text("invitee_stripe_payment_id"),
  competitionId: varchar("competition_id").references(() => competitions.id),
  winnerId: varchar("winner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  passwordHash: true,
  role: true,
});

export const usernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
});

export const insertCompetitionEntrySchema = createInsertSchema(
  competitionEntries,
).omit({
  id: true,
  joinedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFillSchema = createInsertSchema(fills).omit({
  id: true,
  createdAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const insertPvpChallengeSchema = createInsertSchema(pvpChallenges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  openedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type CompetitionEntry = typeof competitionEntries.$inferSelect;
export type InsertCompetitionEntry = z.infer<
  typeof insertCompetitionEntrySchema
>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Fill = typeof fills.$inferSelect;
export type InsertFill = z.infer<typeof insertFillSchema>;
export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type PvpChallenge = typeof pvpChallenges.$inferSelect;
export type InsertPvpChallenge = z.infer<typeof insertPvpChallengeSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull().unique(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  variables: jsonb("variables").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  templateType: text("template_type").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  resendMessageId: text("resend_message_id"),
  errorMessage: text("error_message"),
  variablesJson: jsonb("variables_json"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

export const candleCache = pgTable("candle_cache", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pair: text("pair").notNull(),
  timeframe: text("timeframe").notNull(),
  time: integer("time").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  volume: integer("volume"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export type CandleCacheEntry = typeof candleCache.$inferSelect;

export const wallets = pgTable("wallets", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id)
    .notNull(),
  balanceTokens: integer("balance_tokens").notNull().default(0),
  lockedTokens: integer("locked_tokens").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tokenTransactionKinds = [
  "PURCHASE",
  "COMPETITION_ENTRY",
  "PVP_STAKE_LOCK",
  "PVP_STAKE_RELEASE",
  "BET_PLACE",
  "BET_REFUND",
  "BET_PAYOUT",
  "RAKE_FEE",
  "ADJUSTMENT",
] as const;

export type TokenTransactionKind = typeof tokenTransactionKinds[number];

export const tokenTransactions = pgTable("token_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  kind: text("kind").notNull(),
  amountTokens: integer("amount_tokens").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type TokenTransaction = typeof tokenTransactions.$inferSelect;
export type InsertTokenTransaction = typeof tokenTransactions.$inferInsert;
