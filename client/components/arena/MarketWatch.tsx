import React from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface Quote {
  pair: string;
  bid: number;
  ask: number;
  prevBid?: number;
  prevAsk?: number;
}

interface MarketWatchProps {
  pairs: string[];
  quotes: Record<string, Quote>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
  formatPrice: (price: number, pair: string) => string;
  searchRef?: React.RefObject<TextInput | null>;
}

export function MarketWatch({ 
  pairs, 
  quotes, 
  selectedPair, 
  onSelectPair, 
  formatPrice,
  searchRef,
}: MarketWatchProps) {
  const [search, setSearch] = React.useState("");
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set(["EUR-USD"]));
  
  const filteredPairs = pairs.filter(pair => 
    pair.toLowerCase().includes(search.toLowerCase())
  );
  
  const sortedPairs = [...filteredPairs].sort((a, b) => {
    const aFav = favorites.has(a);
    const bFav = favorites.has(b);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const toggleFavorite = (pair: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(pair)) {
        next.delete(pair);
      } else {
        next.add(pair);
      }
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Market Watch</ThemedText>
      </View>
      
      <View style={styles.searchRow}>
        <Feather name="search" size={14} color={TerminalColors.textMuted} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search symbols..."
          placeholderTextColor={TerminalColors.textMuted}
        />
      </View>
      
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, styles.symbolCol]}>Symbol</ThemedText>
        <ThemedText style={[styles.headerCell, styles.priceCol]}>Bid</ThemedText>
        <ThemedText style={[styles.headerCell, styles.priceCol]}>Ask</ThemedText>
        <ThemedText style={[styles.headerCell, styles.spreadCol]}>Spread</ThemedText>
      </View>
      
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={false}>
        {sortedPairs.map((pair) => {
          const quote = quotes[pair];
          const isSelected = selectedPair === pair;
          const isFavorite = favorites.has(pair);
          const bidTick = quote && quote.prevBid 
            ? (quote.bid > quote.prevBid ? "up" : quote.bid < quote.prevBid ? "down" : null) 
            : null;
          const askTick = quote && quote.prevAsk
            ? (quote.ask > quote.prevAsk ? "up" : quote.ask < quote.prevAsk ? "down" : null)
            : null;
          const spread = quote ? ((quote.ask - quote.bid) * 10000).toFixed(1) : "-";
          
          return (
            <Pressable
              key={pair}
              style={[styles.tableRow, isSelected && styles.tableRowSelected]}
              onPress={() => onSelectPair(pair)}
            >
              <View style={styles.symbolCol}>
                <Pressable 
                  style={styles.starBtn} 
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleFavorite(pair);
                  }}
                >
                  <Feather 
                    name={isFavorite ? "star" : "star"} 
                    size={12} 
                    color={isFavorite ? TerminalColors.warning : TerminalColors.textMuted} 
                    style={isFavorite ? { opacity: 1 } : { opacity: 0.3 }}
                  />
                </Pressable>
                <ThemedText style={[styles.symbolText, isSelected && styles.symbolTextSelected]}>
                  {pair.replace("-", "/")}
                </ThemedText>
              </View>
              <View style={[styles.priceCol, styles.priceCell]}>
                {bidTick === "up" ? (
                  <Feather name="chevron-up" size={10} color={TerminalColors.positive} />
                ) : bidTick === "down" ? (
                  <Feather name="chevron-down" size={10} color={TerminalColors.negative} />
                ) : null}
                <ThemedText style={[
                  styles.priceText, 
                  styles.bidText,
                  bidTick === "up" && styles.priceUp,
                  bidTick === "down" && styles.priceDown,
                ]}>
                  {quote ? formatPrice(quote.bid, pair) : "-.-----"}
                </ThemedText>
              </View>
              <View style={[styles.priceCol, styles.priceCell]}>
                {askTick === "up" ? (
                  <Feather name="chevron-up" size={10} color={TerminalColors.positive} />
                ) : askTick === "down" ? (
                  <Feather name="chevron-down" size={10} color={TerminalColors.negative} />
                ) : null}
                <ThemedText style={[
                  styles.priceText,
                  styles.askText,
                  askTick === "up" && styles.priceUp,
                  askTick === "down" && styles.priceDown,
                ]}>
                  {quote ? formatPrice(quote.ask, pair) : "-.-----"}
                </ThemedText>
              </View>
              <ThemedText style={[styles.spreadCol, styles.spreadText]}>{spread}</ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TerminalColors.bgPanel,
  },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.5,
  },
  
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: TerminalColors.textPrimary,
    padding: 0,
  },
  
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  headerCell: {
    fontSize: 10,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.3,
  },
  
  tableBody: {
    flex: 1,
  },
  
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  tableRowSelected: {
    backgroundColor: "rgba(209, 75, 58, 0.1)",
  },
  
  symbolCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  starBtn: {
    padding: 2,
  },
  
  symbolText: {
    fontSize: 12,
    fontWeight: "600",
    color: TerminalColors.textSecondary,
  },
  
  symbolTextSelected: {
    color: TerminalColors.textPrimary,
  },
  
  priceCol: {
    width: 75,
    textAlign: "right",
  },
  
  priceCell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  
  spreadCol: {
    width: 45,
    textAlign: "right",
  },
  
  priceText: {
    ...TerminalTypography.tableCell,
    textAlign: "right",
  },
  
  bidText: {
    color: TerminalColors.negative,
  },
  
  askText: {
    color: TerminalColors.positive,
  },
  
  priceUp: {
    color: TerminalColors.positive,
  },
  
  priceDown: {
    color: TerminalColors.negative,
  },
  
  spreadText: {
    ...TerminalTypography.tableCell,
    color: TerminalColors.textMuted,
    textAlign: "right",
  },
});
