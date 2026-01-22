import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { TerminalColors, TerminalTypography } from "@/components/terminal";

interface Quote {
  pair: string;
  bid: number;
  ask: number;
  spreadPips: number;
  status: "live" | "delayed" | "stale" | "disconnected";
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
  isMockData?: boolean;
}

type FilterType = "all" | "favorites" | "forex" | "metals";

const PAIR_NAMES: Record<string, string> = {
  "EUR-USD": "Euro / US Dollar",
  "GBP-USD": "British Pound / US Dollar", 
  "USD-JPY": "US Dollar / Japanese Yen",
  "AUD-USD": "Australian Dollar / US Dollar",
  "USD-CAD": "US Dollar / Canadian Dollar",
  "USD-CHF": "US Dollar / Swiss Franc",
  "NZD-USD": "New Zealand Dollar / US Dollar",
  "EUR-GBP": "Euro / British Pound",
  "EUR-JPY": "Euro / Japanese Yen",
  "GBP-JPY": "British Pound / Japanese Yen",
};

function getShortName(pair: string): string {
  const names = PAIR_NAMES[pair];
  if (!names) return pair.replace("-", "/");
  const parts = names.split(" / ");
  if (parts.length === 2) {
    const first = parts[0].split(" ")[0];
    const second = parts[1].split(" ")[0];
    return `${first}/${second}`;
  }
  return pair.replace("-", "/");
}

export function MarketWatch({ 
  pairs, 
  quotes, 
  selectedPair, 
  onSelectPair, 
  formatPrice,
  searchRef,
  isMockData = true,
}: MarketWatchProps) {
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["EUR-USD", "GBP-USD"]));
  const [filter, setFilter] = useState<FilterType>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [tickFlash, setTickFlash] = useState<Record<string, { bid?: "up" | "down"; ask?: "up" | "down" }>>({});
  const prevQuotesRef = useRef<Record<string, Quote>>({});

  useEffect(() => {
    const newFlashes: Record<string, { bid?: "up" | "down"; ask?: "up" | "down" }> = {};
    let hasFlashes = false;

    pairs.forEach(pair => {
      const quote = quotes[pair];
      const prevQuote = prevQuotesRef.current[pair];
      
      if (quote && prevQuote) {
        if (quote.bid !== prevQuote.bid) {
          newFlashes[pair] = { 
            ...newFlashes[pair], 
            bid: quote.bid > prevQuote.bid ? "up" : "down" 
          };
          hasFlashes = true;
        }
        if (quote.ask !== prevQuote.ask) {
          newFlashes[pair] = { 
            ...newFlashes[pair], 
            ask: quote.ask > prevQuote.ask ? "up" : "down" 
          };
          hasFlashes = true;
        }
      }
    });

    if (hasFlashes) {
      setTickFlash(newFlashes);
      const timer = setTimeout(() => setTickFlash({}), 300);
      return () => clearTimeout(timer);
    }
    
    prevQuotesRef.current = { ...quotes };
  }, [quotes, pairs]);

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.toLowerCase().includes(search.toLowerCase()) ||
      getShortName(pair).toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === "favorites") return favorites.has(pair);
    if (filter === "forex") return true;
    if (filter === "metals") return false;
    return true;
  });
  
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

  const connectionStatus = isMockData ? "mock" : "live";

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "favorites", label: "Favorites" },
    { key: "forex", label: "Forex" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Market Watch</ThemedText>
        <View style={styles.connectionIndicator}>
          <View style={[
            styles.connectionDot,
            connectionStatus === "live" ? styles.connectionLive : styles.connectionStale
          ]} />
          <ThemedText style={[
            styles.connectionText,
            connectionStatus === "live" ? styles.connectionTextLive : styles.connectionTextStale
          ]}>
            {connectionStatus === "live" ? "LIVE" : "DEMO"}
          </ThemedText>
        </View>
      </View>
      
      <View style={styles.controlsRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={12} color={TerminalColors.textMuted} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor={TerminalColors.textMuted}
          />
        </View>
        
        <Pressable 
          style={styles.filterDropdown}
          onPress={() => setShowFilterDropdown(!showFilterDropdown)}
        >
          <ThemedText style={styles.filterText}>
            {filterOptions.find(f => f.key === filter)?.label || "All"}
          </ThemedText>
          <Feather name="chevron-down" size={12} color={TerminalColors.textMuted} />
        </Pressable>
        
        <Pressable 
          style={styles.favoritesBtn}
          onPress={() => setFilter(filter === "favorites" ? "all" : "favorites")}
        >
          <Feather 
            name="star" 
            size={14} 
            color={filter === "favorites" ? TerminalColors.warning : TerminalColors.textMuted} 
          />
        </Pressable>
      </View>

      {showFilterDropdown && Platform.OS === "web" && (
        <View style={styles.dropdownMenu}>
          {filterOptions.map(opt => (
            <Pressable
              key={opt.key}
              style={[styles.dropdownItem, filter === opt.key && styles.dropdownItemActive]}
              onPress={() => {
                setFilter(opt.key);
                setShowFilterDropdown(false);
              }}
            >
              <ThemedText style={[
                styles.dropdownItemText,
                filter === opt.key && styles.dropdownItemTextActive
              ]}>
                {opt.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
      
      <View style={styles.tableHeader}>
        <ThemedText style={[styles.headerCell, styles.symbolCol]}>SYMBOL</ThemedText>
        <ThemedText style={[styles.headerCell, styles.bidCol]}>BID</ThemedText>
        <ThemedText style={[styles.headerCell, styles.askCol]}>ASK</ThemedText>
        <ThemedText style={[styles.headerCell, styles.spreadCol]}>SPREAD</ThemedText>
        <ThemedText style={[styles.headerCell, styles.nameCol]}>NAME</ThemedText>
      </View>
      
      <ScrollView style={styles.tableBody} showsVerticalScrollIndicator={true}>
        {sortedPairs.map((pair) => {
          const quote = quotes[pair];
          const isSelected = selectedPair === pair;
          const isFavorite = favorites.has(pair);
          const isStale = quote?.status === "stale" || quote?.status === "disconnected";
          const flash = tickFlash[pair];
          const spread = quote ? quote.spreadPips.toFixed(1) : "-";
          
          return (
            <Pressable
              key={pair}
              style={[
                styles.tableRow, 
                isSelected && styles.tableRowSelected,
                isStale && styles.tableRowStale,
              ]}
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
                    name="star" 
                    size={10} 
                    color={isFavorite ? TerminalColors.warning : TerminalColors.textMuted} 
                    style={{ opacity: isFavorite ? 1 : 0.4 }}
                  />
                </Pressable>
                <ThemedText style={[
                  styles.symbolText, 
                  isSelected && styles.symbolTextSelected,
                  isStale && styles.textStale,
                ]}>
                  {pair.replace("-", "/")}
                </ThemedText>
              </View>
              
              <View style={styles.bidCol}>
                <ThemedText style={[
                  styles.priceText, 
                  styles.bidText,
                  flash?.bid === "up" && styles.flashUp,
                  flash?.bid === "down" && styles.flashDown,
                  isStale && styles.textStale,
                ]}>
                  {quote ? formatPrice(quote.bid, pair) : "-.-----"}
                </ThemedText>
              </View>
              
              <View style={styles.askCol}>
                <ThemedText style={[
                  styles.priceText,
                  styles.askText,
                  flash?.ask === "up" && styles.flashUp,
                  flash?.ask === "down" && styles.flashDown,
                  isStale && styles.textStale,
                ]}>
                  {quote ? formatPrice(quote.ask, pair) : "-.-----"}
                </ThemedText>
              </View>
              
              <View style={styles.spreadCol}>
                <ThemedText style={[
                  styles.spreadText,
                  isStale && styles.textStale,
                ]}>
                  {spread}
                </ThemedText>
              </View>
              
              <View style={styles.nameCol}>
                <ThemedText 
                  style={[styles.nameText, isStale && styles.textStale]} 
                  numberOfLines={1}
                >
                  {getShortName(pair)}
                </ThemedText>
              </View>
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: TerminalColors.textPrimary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  
  connectionIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  
  connectionLive: {
    backgroundColor: TerminalColors.positive,
  },
  
  connectionStale: {
    backgroundColor: TerminalColors.warning,
  },
  
  connectionText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  
  connectionTextLive: {
    color: TerminalColors.positive,
  },
  
  connectionTextStale: {
    color: TerminalColors.warning,
  },
  
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: TerminalColors.textPrimary,
    padding: 0,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  
  filterDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TerminalColors.bgBase,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  
  filterText: {
    fontSize: 10,
    color: TerminalColors.textSecondary,
  },
  
  favoritesBtn: {
    padding: 4,
    borderRadius: 4,
  },
  
  dropdownMenu: {
    position: "absolute",
    top: 76,
    right: 40,
    backgroundColor: TerminalColors.bgPanel,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    borderRadius: 4,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  dropdownItemActive: {
    backgroundColor: "rgba(209, 75, 58, 0.1)",
  },
  
  dropdownItemText: {
    fontSize: 11,
    color: TerminalColors.textSecondary,
  },
  
  dropdownItemTextActive: {
    color: TerminalColors.accent,
  },
  
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: TerminalColors.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  headerCell: {
    fontSize: 9,
    fontWeight: "600",
    color: TerminalColors.textMuted,
    letterSpacing: 0.5,
  },
  
  tableBody: {
    flex: 1,
  },
  
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
  },
  
  tableRowSelected: {
    backgroundColor: "rgba(70, 130, 180, 0.15)",
    borderLeftWidth: 2,
    borderLeftColor: "#4682B4",
  },
  
  tableRowStale: {
    opacity: 0.5,
  },
  
  symbolCol: {
    width: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  
  bidCol: {
    width: 62,
    alignItems: "flex-end",
  },
  
  askCol: {
    width: 62,
    alignItems: "flex-end",
  },
  
  spreadCol: {
    width: 42,
    alignItems: "flex-end",
  },
  
  nameCol: {
    flex: 1,
    paddingLeft: 8,
  },
  
  starBtn: {
    padding: 2,
  },
  
  symbolText: {
    fontSize: 11,
    fontWeight: "600",
    color: TerminalColors.textSecondary,
  },
  
  symbolTextSelected: {
    color: TerminalColors.textPrimary,
  },
  
  priceText: {
    ...TerminalTypography.tableCell,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  
  bidText: {
    color: "#E57373",
  },
  
  askText: {
    color: "#81C784",
  },
  
  flashUp: {
    backgroundColor: "rgba(129, 199, 132, 0.3)",
    color: TerminalColors.positive,
  },
  
  flashDown: {
    backgroundColor: "rgba(229, 115, 115, 0.3)",
    color: TerminalColors.negative,
  },
  
  spreadText: {
    ...TerminalTypography.tableCell,
    fontSize: 10,
    color: TerminalColors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  
  nameText: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
  
  textStale: {
    color: TerminalColors.textMuted,
    opacity: 0.6,
  },
});
