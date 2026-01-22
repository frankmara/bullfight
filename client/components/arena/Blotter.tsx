import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, Modal, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface Position {
  id: string;
  pair: string;
  side: string;
  quantityUnits: number;
  avgEntryPrice: number;
  unrealizedPnlCents: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  openAt?: string;
}

interface PendingOrder {
  id: string;
  pair: string;
  side: string;
  type: string;
  quantityUnits: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  createdAt?: string;
}

interface ClosedTrade {
  id: string;
  pair: string;
  sideInitial: string;
  totalInUnits: number;
  totalOutUnits: number;
  avgEntryPrice: number;
  avgExitPrice?: number;
  realizedPnlCents: number;
  status: string;
  openedAt: string;
  closedAt?: string;
}

interface BlotterProps {
  positions: Position[];
  pendingOrders: PendingOrder[];
  closedTrades: ClosedTrade[];
  quotes: Record<string, { bid: number; ask: number }>;
  onClosePosition: (positionId: string) => void;
  onPartialClose: (positionId: string, lots?: number, percentage?: number) => void;
  onEditPosition: (positionId: string, stopLossPrice?: number | null, takeProfitPrice?: number | null) => void;
  onCancelOrder: (orderId: string) => void;
  onEditOrder: (orderId: string, updates: { limitPrice?: number; stopPrice?: number; stopLossPrice?: number | null; takeProfitPrice?: number | null }) => void;
  formatPrice: (price: number, pair: string) => string;
  formatCurrency: (cents: number) => string;
  unitsToLots: (units: number) => number;
  balance?: number;
  equity?: number;
  pnl?: number;
  onCloseAll?: () => void;
}

type BlotterTab = "positions" | "pending" | "closed" | "trades" | "deals" | "orders";

const TABS: { key: BlotterTab; label: string }[] = [
  { key: "positions", label: "Positions" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed Positions" },
  { key: "trades", label: "Trades" },
  { key: "deals", label: "Deal History" },
  { key: "orders", label: "Order History" },
];

interface PartialCloseModalProps {
  visible: boolean;
  position: Position | null;
  onClose: () => void;
  onConfirm: (lots?: number, percentage?: number) => void;
  unitsToLots: (units: number) => number;
}

function PartialCloseModal({ visible, position, onClose, onConfirm, unitsToLots }: PartialCloseModalProps) {
  const [closeType, setCloseType] = useState<'lots' | 'percent'>('percent');
  const [value, setValue] = useState('50');

  if (!position) return null;

  const currentLots = unitsToLots(position.quantityUnits);

  const handleConfirm = () => {
    if (closeType === 'lots') {
      onConfirm(parseFloat(value), undefined);
    } else {
      onConfirm(undefined, parseFloat(value));
    }
    onClose();
  };

  const modalContent = (
    <View style={modalStyles.backdrop}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <ThemedText style={modalStyles.title}>Partial Close</ThemedText>
          <Pressable onPress={onClose}>
            <Feather name="x" size={20} color={TerminalColors.textMuted} />
          </Pressable>
        </View>
        
        <ThemedText style={modalStyles.info}>
          {position.pair} | {position.side.toUpperCase()} | {currentLots.toFixed(2)} lots
        </ThemedText>
        
        <View style={modalStyles.toggleRow}>
          <Pressable 
            style={[modalStyles.toggleBtn, closeType === 'percent' && modalStyles.toggleActive]}
            onPress={() => setCloseType('percent')}
          >
            <ThemedText style={[modalStyles.toggleText, closeType === 'percent' && modalStyles.toggleTextActive]}>
              By %
            </ThemedText>
          </Pressable>
          <Pressable 
            style={[modalStyles.toggleBtn, closeType === 'lots' && modalStyles.toggleActive]}
            onPress={() => setCloseType('lots')}
          >
            <ThemedText style={[modalStyles.toggleText, closeType === 'lots' && modalStyles.toggleTextActive]}>
              By Lots
            </ThemedText>
          </Pressable>
        </View>
        
        <View style={modalStyles.inputRow}>
          <TextInput
            style={modalStyles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder={closeType === 'lots' ? 'Lots to close' : 'Percentage'}
            placeholderTextColor={TerminalColors.textMuted}
          />
          <ThemedText style={modalStyles.inputSuffix}>
            {closeType === 'lots' ? 'lots' : '%'}
          </ThemedText>
        </View>
        
        {closeType === 'percent' && (
          <View style={modalStyles.quickBtns}>
            {[25, 50, 75].map(pct => (
              <Pressable key={pct} style={modalStyles.quickBtn} onPress={() => setValue(String(pct))}>
                <ThemedText style={modalStyles.quickBtnText}>{pct}%</ThemedText>
              </Pressable>
            ))}
          </View>
        )}
        
        <View style={modalStyles.actions}>
          <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
            <ThemedText style={modalStyles.cancelBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable style={modalStyles.confirmBtn} onPress={handleConfirm}>
            <ThemedText style={modalStyles.confirmBtnText}>Close Position</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return visible ? modalContent : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {modalContent}
    </Modal>
  );
}

interface EditSLTPModalProps {
  visible: boolean;
  position: Position | null;
  onClose: () => void;
  onConfirm: (sl?: number | null, tp?: number | null) => void;
  formatPrice: (price: number, pair: string) => string;
}

function EditSLTPModal({ visible, position, onClose, onConfirm, formatPrice }: EditSLTPModalProps) {
  const [slValue, setSLValue] = useState('');
  const [tpValue, setTPValue] = useState('');

  React.useEffect(() => {
    if (position) {
      setSLValue(position.stopLossPrice ? String(position.stopLossPrice) : '');
      setTPValue(position.takeProfitPrice ? String(position.takeProfitPrice) : '');
    }
  }, [position]);

  if (!position) return null;

  const handleConfirm = () => {
    const sl = slValue ? parseFloat(slValue) : null;
    const tp = tpValue ? parseFloat(tpValue) : null;
    onConfirm(sl, tp);
    onClose();
  };

  const modalContent = (
    <View style={modalStyles.backdrop}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <ThemedText style={modalStyles.title}>Edit SL/TP</ThemedText>
          <Pressable onPress={onClose}>
            <Feather name="x" size={20} color={TerminalColors.textMuted} />
          </Pressable>
        </View>
        
        <ThemedText style={modalStyles.info}>
          {position.pair} | Entry: {formatPrice(position.avgEntryPrice, position.pair)}
        </ThemedText>
        
        <View style={modalStyles.formGroup}>
          <ThemedText style={modalStyles.label}>Stop Loss</ThemedText>
          <TextInput
            style={modalStyles.input}
            value={slValue}
            onChangeText={setSLValue}
            keyboardType="numeric"
            placeholder="No stop loss"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        
        <View style={modalStyles.formGroup}>
          <ThemedText style={modalStyles.label}>Take Profit</ThemedText>
          <TextInput
            style={modalStyles.input}
            value={tpValue}
            onChangeText={setTPValue}
            keyboardType="numeric"
            placeholder="No take profit"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        
        <View style={modalStyles.actions}>
          <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
            <ThemedText style={modalStyles.cancelBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable style={modalStyles.confirmBtn} onPress={handleConfirm}>
            <ThemedText style={modalStyles.confirmBtnText}>Update</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return visible ? modalContent : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {modalContent}
    </Modal>
  );
}

interface EditOrderModalProps {
  visible: boolean;
  order: PendingOrder | null;
  onClose: () => void;
  onConfirm: (updates: { limitPrice?: number; stopPrice?: number; stopLossPrice?: number | null; takeProfitPrice?: number | null }) => void;
  formatPrice: (price: number, pair: string) => string;
}

function EditOrderModal({ visible, order, onClose, onConfirm, formatPrice }: EditOrderModalProps) {
  const [limitValue, setLimitValue] = useState('');
  const [stopValue, setStopValue] = useState('');
  const [slValue, setSLValue] = useState('');
  const [tpValue, setTPValue] = useState('');

  React.useEffect(() => {
    if (order) {
      setLimitValue(order.limitPrice ? String(order.limitPrice) : '');
      setStopValue(order.stopPrice ? String(order.stopPrice) : '');
      setSLValue(order.stopLossPrice ? String(order.stopLossPrice) : '');
      setTPValue(order.takeProfitPrice ? String(order.takeProfitPrice) : '');
    }
  }, [order]);

  if (!order) return null;

  const handleConfirm = () => {
    onConfirm({
      limitPrice: limitValue ? parseFloat(limitValue) : undefined,
      stopPrice: stopValue ? parseFloat(stopValue) : undefined,
      stopLossPrice: slValue ? parseFloat(slValue) : null,
      takeProfitPrice: tpValue ? parseFloat(tpValue) : null,
    });
    onClose();
  };

  const modalContent = (
    <View style={modalStyles.backdrop}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <ThemedText style={modalStyles.title}>Edit Order</ThemedText>
          <Pressable onPress={onClose}>
            <Feather name="x" size={20} color={TerminalColors.textMuted} />
          </Pressable>
        </View>
        
        <ThemedText style={modalStyles.info}>
          {order.pair} | {order.type.toUpperCase()} {order.side.toUpperCase()}
        </ThemedText>
        
        {order.type === 'limit' && (
          <View style={modalStyles.formGroup}>
            <ThemedText style={modalStyles.label}>Limit Price</ThemedText>
            <TextInput
              style={modalStyles.input}
              value={limitValue}
              onChangeText={setLimitValue}
              keyboardType="numeric"
              placeholderTextColor={TerminalColors.textMuted}
            />
          </View>
        )}
        
        {order.type === 'stop' && (
          <View style={modalStyles.formGroup}>
            <ThemedText style={modalStyles.label}>Stop Price</ThemedText>
            <TextInput
              style={modalStyles.input}
              value={stopValue}
              onChangeText={setStopValue}
              keyboardType="numeric"
              placeholderTextColor={TerminalColors.textMuted}
            />
          </View>
        )}
        
        <View style={modalStyles.formGroup}>
          <ThemedText style={modalStyles.label}>Stop Loss</ThemedText>
          <TextInput
            style={modalStyles.input}
            value={slValue}
            onChangeText={setSLValue}
            keyboardType="numeric"
            placeholder="No stop loss"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        
        <View style={modalStyles.formGroup}>
          <ThemedText style={modalStyles.label}>Take Profit</ThemedText>
          <TextInput
            style={modalStyles.input}
            value={tpValue}
            onChangeText={setTPValue}
            keyboardType="numeric"
            placeholder="No take profit"
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        
        <View style={modalStyles.actions}>
          <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
            <ThemedText style={modalStyles.cancelBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable style={modalStyles.confirmBtn} onPress={handleConfirm}>
            <ThemedText style={modalStyles.confirmBtnText}>Update</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return visible ? modalContent : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {modalContent}
    </Modal>
  );
}

export function Blotter({
  positions,
  pendingOrders,
  closedTrades,
  quotes,
  onClosePosition,
  onPartialClose,
  onEditPosition,
  onCancelOrder,
  onEditOrder,
  formatPrice,
  formatCurrency,
  unitsToLots,
  balance = 0,
  equity = 0,
  pnl = 0,
  onCloseAll,
}: BlotterProps) {
  const [activeTab, setActiveTab] = useState<BlotterTab>("positions");
  const [partialCloseModal, setPartialCloseModal] = useState<Position | null>(null);
  const [editSLTPModal, setEditSLTPModal] = useState<Position | null>(null);
  const [editOrderModal, setEditOrderModal] = useState<PendingOrder | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const totalPositions = positions.length;
  const totalPending = pendingOrders.length;
  const totalClosed = closedTrades.length;
  
  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <Feather name="inbox" size={20} color={TerminalColors.textMuted} />
      <ThemedText style={styles.emptyStateText}>{message}</ThemedText>
    </View>
  );

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const renderPositionsTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { width: 70 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 45 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 55, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>Entry</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>Market</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 65, textAlign: "right" }]}>SL</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 65, textAlign: "right" }]}>TP</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>P&L</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 90 }]}>Open Time</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 90, textAlign: "center" }]}>Actions</ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {positions.length > 0 ? (
          positions.map((pos) => {
            const quote = quotes[pos.pair];
            const markPrice = pos.side === "buy" ? quote?.bid : quote?.ask;
            return (
              <View key={pos.id} style={styles.tableRow}>
                <ThemedText style={[styles.cellText, { width: 70, fontWeight: "600" }]}>{pos.pair}</ThemedText>
                <View style={[styles.sideBadge, pos.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 45 }]}>
                  <ThemedText style={styles.sideBadgeText}>{pos.side.toUpperCase()}</ThemedText>
                </View>
                <ThemedText style={[styles.cellTextMono, { width: 55, textAlign: "right" }]}>
                  {unitsToLots(pos.quantityUnits).toFixed(2)}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 75, textAlign: "right" }]}>
                  {formatPrice(pos.avgEntryPrice, pos.pair)}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 75, textAlign: "right" }]}>
                  {markPrice ? formatPrice(markPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 65, textAlign: "right", color: pos.stopLossPrice ? TerminalColors.negative : TerminalColors.textMuted }]}>
                  {pos.stopLossPrice ? formatPrice(pos.stopLossPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[styles.cellTextMono, { width: 65, textAlign: "right", color: pos.takeProfitPrice ? TerminalColors.positive : TerminalColors.textMuted }]}>
                  {pos.takeProfitPrice ? formatPrice(pos.takeProfitPrice, pos.pair) : "—"}
                </ThemedText>
                <ThemedText style={[
                  styles.cellTextMono, 
                  { width: 75, textAlign: "right", fontWeight: "600" },
                  { color: pos.unrealizedPnlCents >= 0 ? TerminalColors.positive : TerminalColors.negative }
                ]}>
                  {pos.unrealizedPnlCents >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnlCents)}
                </ThemedText>
                <ThemedText style={[styles.cellText, { width: 90, fontSize: 9, color: TerminalColors.textMuted }]}>
                  {formatDateTime(pos.openAt)}
                </ThemedText>
                <View style={[styles.actionsCell, { width: 90 }]}>
                  <Pressable style={styles.actionBtn} onPress={() => setEditSLTPModal(pos)} testID={`btn-edit-position-${pos.id}`}>
                    <Feather name="edit-2" size={12} color={TerminalColors.textMuted} />
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => setPartialCloseModal(pos)} testID={`btn-partial-close-${pos.id}`}>
                    <Feather name="scissors" size={12} color={TerminalColors.warning} />
                  </Pressable>
                  <Pressable style={styles.closeBtn} onPress={() => onClosePosition(pos.id)} testID={`btn-close-position-${pos.id}`}>
                    <Feather name="x" size={12} color={TerminalColors.negative} />
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : renderEmptyState("No open positions")}
      </ScrollView>
    </View>
  );

  const renderPendingTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { width: 70 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 50 }]}>Type</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 45 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 55, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>Price</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 65, textAlign: "right" }]}>SL</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 65, textAlign: "right" }]}>TP</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 90 }]}>Created</ThemedText>
        <ThemedText style={[styles.headerCell, { flex: 1, fontSize: 8 }]}>Order ID</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 70, textAlign: "center" }]}>Actions</ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {pendingOrders.length > 0 ? (
          pendingOrders.map((order) => (
            <View key={order.id} style={styles.tableRow}>
              <ThemedText style={[styles.cellText, { width: 70, fontWeight: "600" }]}>{order.pair}</ThemedText>
              <View style={[styles.typeBadge, { width: 50 }]}>
                <ThemedText style={styles.typeBadgeText}>{order.type.toUpperCase()}</ThemedText>
              </View>
              <View style={[styles.sideBadge, order.side === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 45 }]}>
                <ThemedText style={styles.sideBadgeText}>{order.side.toUpperCase()}</ThemedText>
              </View>
              <ThemedText style={[styles.cellTextMono, { width: 55, textAlign: "right" }]}>
                {unitsToLots(order.quantityUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 75, textAlign: "right" }]}>
                {order.limitPrice 
                  ? formatPrice(order.limitPrice, order.pair) 
                  : order.stopPrice 
                    ? formatPrice(order.stopPrice, order.pair) 
                    : "—"}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 65, textAlign: "right", color: order.stopLossPrice ? TerminalColors.negative : TerminalColors.textMuted }]}>
                {order.stopLossPrice ? formatPrice(order.stopLossPrice, order.pair) : "—"}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 65, textAlign: "right", color: order.takeProfitPrice ? TerminalColors.positive : TerminalColors.textMuted }]}>
                {order.takeProfitPrice ? formatPrice(order.takeProfitPrice, order.pair) : "—"}
              </ThemedText>
              <ThemedText style={[styles.cellText, { width: 90, fontSize: 9, color: TerminalColors.textMuted }]}>
                {formatDateTime(order.createdAt)}
              </ThemedText>
              <ThemedText style={[styles.cellText, { flex: 1, fontSize: 8, color: TerminalColors.textMuted }]} numberOfLines={1}>
                {order.id.slice(0, 8)}...
              </ThemedText>
              <View style={[styles.actionsCell, { width: 70 }]}>
                <Pressable style={styles.actionBtn} onPress={() => setEditOrderModal(order)} testID={`btn-edit-order-${order.id}`}>
                  <Feather name="edit-2" size={12} color={TerminalColors.textMuted} />
                </Pressable>
                <Pressable style={styles.closeBtn} onPress={() => onCancelOrder(order.id)} testID={`btn-cancel-order-${order.id}`}>
                  <Feather name="x" size={12} color={TerminalColors.negative} />
                </Pressable>
              </View>
            </View>
          ))
        ) : renderEmptyState("No pending orders")}
      </ScrollView>
    </View>
  );

  const renderClosedTab = () => (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, { width: 70 }]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 45 }]}>Side</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 55, textAlign: "right" }]}>Lots</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>Entry</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 75, textAlign: "right" }]}>Exit</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 85, textAlign: "right" }]}>Realized P&L</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 90 }]}>Open Time</ThemedText>
        <ThemedText style={[styles.headerCell, { width: 90 }]}>Close Time</ThemedText>
        <ThemedText style={[styles.headerCell, { flex: 1, fontSize: 8 }]}>Trade ID</ThemedText>
      </View>
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {closedTrades.length > 0 ? (
          closedTrades.slice(0, 50).map((trade) => (
            <View key={trade.id} style={styles.tableRow}>
              <ThemedText style={[styles.cellText, { width: 70, fontWeight: "600" }]}>{trade.pair}</ThemedText>
              <View style={[styles.sideBadge, trade.sideInitial === "buy" ? styles.sideBadgeBuy : styles.sideBadgeSell, { width: 45 }]}>
                <ThemedText style={styles.sideBadgeText}>{trade.sideInitial.toUpperCase()}</ThemedText>
              </View>
              <ThemedText style={[styles.cellTextMono, { width: 55, textAlign: "right" }]}>
                {unitsToLots(trade.totalInUnits).toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 75, textAlign: "right" }]}>
                {formatPrice(trade.avgEntryPrice, trade.pair)}
              </ThemedText>
              <ThemedText style={[styles.cellTextMono, { width: 75, textAlign: "right" }]}>
                {trade.avgExitPrice ? formatPrice(trade.avgExitPrice, trade.pair) : "—"}
              </ThemedText>
              <ThemedText style={[
                styles.cellTextMono, 
                { width: 85, textAlign: "right", fontWeight: "600" },
                { color: trade.realizedPnlCents >= 0 ? TerminalColors.positive : TerminalColors.negative }
              ]}>
                {trade.realizedPnlCents >= 0 ? "+" : ""}{formatCurrency(trade.realizedPnlCents)}
              </ThemedText>
              <ThemedText style={[styles.cellText, { width: 90, fontSize: 9, color: TerminalColors.textMuted }]}>
                {formatDateTime(trade.openedAt)}
              </ThemedText>
              <ThemedText style={[styles.cellText, { width: 90, fontSize: 9, color: TerminalColors.textMuted }]}>
                {formatDateTime(trade.closedAt)}
              </ThemedText>
              <ThemedText style={[styles.cellText, { flex: 1, fontSize: 8, color: TerminalColors.textMuted }]} numberOfLines={1}>
                {trade.id.slice(0, 8)}...
              </ThemedText>
            </View>
          ))
        ) : renderEmptyState("No closed positions")}
      </ScrollView>
    </View>
  );

  const renderPlaceholderTab = (tabName: string) => (
    <View style={styles.tableContainer}>
      {renderEmptyState(`${tabName} - Coming soon`)}
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "positions":
        return renderPositionsTab();
      case "pending":
        return renderPendingTab();
      case "closed":
        return renderClosedTab();
      case "trades":
        return renderPlaceholderTab("Trades");
      case "deals":
        return renderPlaceholderTab("Deal History");
      case "orders":
        return renderPlaceholderTab("Order History");
      default:
        return null;
    }
  };

  const formatAmount = (cents: number) => {
    const amount = cents / 100;
    return amount >= 0 
      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `-$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.blotterHeader}>
        <View style={styles.tabBar}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabList}
          >
            {TABS.map((tab) => {
              const count = tab.key === "positions" 
                ? totalPositions 
                : tab.key === "pending" 
                  ? totalPending 
                  : tab.key === "closed" 
                    ? totalClosed 
                    : 0;
                    
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <ThemedText style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </ThemedText>
                  {count > 0 ? (
                    <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                      <ThemedText style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                        {count}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>BALANCE</ThemedText>
            <ThemedText style={styles.metricValue}>{formatAmount(balance)}</ThemedText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>P&L</ThemedText>
            <ThemedText style={[styles.metricValue, pnl >= 0 ? styles.metricPositive : styles.metricNegative]}>
              {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
            </ThemedText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>EQUITY</ThemedText>
            <ThemedText style={styles.metricValue}>{formatAmount(equity)}</ThemedText>
          </View>
          
          <View style={styles.headerActions}>
            <Pressable 
              style={[styles.closeAllBtn, totalPositions === 0 && styles.closeAllBtnDisabled]}
              onPress={onCloseAll}
              disabled={totalPositions === 0}
            >
              <Feather name="x-circle" size={12} color={totalPositions > 0 ? TerminalColors.negative : TerminalColors.textMuted} />
              <ThemedText style={[styles.closeAllText, totalPositions === 0 && styles.closeAllTextDisabled]}>
                Close All
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
      {renderTabContent()}
      
      <PartialCloseModal
        visible={!!partialCloseModal}
        position={partialCloseModal}
        onClose={() => setPartialCloseModal(null)}
        onConfirm={(lots, percentage) => {
          if (partialCloseModal) {
            onPartialClose(partialCloseModal.id, lots, percentage);
          }
        }}
        unitsToLots={unitsToLots}
      />
      
      <EditSLTPModal
        visible={!!editSLTPModal}
        position={editSLTPModal}
        onClose={() => setEditSLTPModal(null)}
        onConfirm={(sl, tp) => {
          if (editSLTPModal) {
            onEditPosition(editSLTPModal.id, sl, tp);
          }
        }}
        formatPrice={formatPrice}
      />
      
      <EditOrderModal
        visible={!!editOrderModal}
        order={editOrderModal}
        onClose={() => setEditOrderModal(null)}
        onConfirm={(updates) => {
          if (editOrderModal) {
            onEditOrder(editOrderModal.id, updates);
          }
        }}
        formatPrice={formatPrice}
      />
    </View>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 8,
    padding: 20,
    width: 340,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: TerminalColors.textPrimary,
  },
  info: {
    fontSize: 12,
    color: TerminalColors.textSecondary,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgInput,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: TerminalColors.accent,
  },
  toggleText: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
  toggleTextActive: {
    color: TerminalColors.textPrimary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: TerminalColors.bgInput,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TerminalColors.textPrimary,
    borderWidth: 1,
    borderColor: TerminalColors.border,
  },
  inputSuffix: {
    fontSize: 12,
    color: TerminalColors.textMuted,
    width: 40,
  },
  quickBtns: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 11,
    color: TerminalColors.textSecondary,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    color: TerminalColors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: TerminalColors.accent,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: TerminalColors.textPrimary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  blotterHeader: {
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  tabBar: {
    flexDirection: "row",
  },
  
  tabList: {
    paddingHorizontal: 8,
  },
  
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  
  tabActive: {
    borderBottomColor: TerminalColors.accent,
  },
  
  tabText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
  },
  
  tabTextActive: {
    color: TerminalColors.textPrimary,
  },
  
  tabBadge: {
    backgroundColor: TerminalColors.bgElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: "center",
  },
  
  tabBadgeActive: {
    backgroundColor: TerminalColors.accent,
  },
  
  tabBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: TerminalColors.textMuted,
  },
  
  tabBadgeTextActive: {
    color: TerminalColors.textPrimary,
  },
  
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgBase,
    borderTopWidth: 1,
    borderTopColor: TerminalColors.border,
  },
  
  metricItem: {
    paddingHorizontal: 12,
  },
  
  metricLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  
  metricValue: {
    fontSize: 11,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  
  metricPositive: {
    color: TerminalColors.positive,
  },
  
  metricNegative: {
    color: TerminalColors.negative,
  },
  
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: TerminalColors.border,
  },
  
  headerActions: {
    marginLeft: "auto",
    flexDirection: "row",
    gap: 8,
  },
  
  closeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(209, 75, 58, 0.1)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: TerminalColors.negative,
  },
  
  closeAllBtnDisabled: {
    backgroundColor: TerminalColors.bgElevated,
    borderColor: TerminalColors.border,
  },
  
  closeAllText: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.negative,
  },
  
  closeAllTextDisabled: {
    color: TerminalColors.textMuted,
  },
  
  tableContainer: {
    flex: 1,
  },
  
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: TerminalColors.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    gap: 6,
  },
  
  headerCell: {
    fontSize: 8,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  
  tableBody: {
    flex: 1,
  },
  
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    gap: 6,
  },
  
  tableRowHovered: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  
  cellText: {
    fontSize: 10,
    color: TerminalColors.textPrimary,
  },
  
  cellTextMono: {
    ...TerminalTypography.tableCell,
    fontSize: 10,
    color: TerminalColors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: "center",
  },
  
  sideBadgeBuy: {
    backgroundColor: "rgba(22, 199, 132, 0.2)",
  },
  
  sideBadgeSell: {
    backgroundColor: "rgba(209, 75, 58, 0.2)",
  },
  
  sideBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.3,
  },
  
  typeBadge: {
    backgroundColor: "rgba(209, 75, 58, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: "center",
  },
  
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: TerminalColors.accent,
    letterSpacing: 0.3,
  },
  
  actionsCell: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
  },
  
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: TerminalColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "rgba(209, 75, 58, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  
  emptyStateText: {
    fontSize: 11,
    color: TerminalColors.textMuted,
    marginTop: 8,
  },
});
