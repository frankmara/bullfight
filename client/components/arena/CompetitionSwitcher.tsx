import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { TerminalColors, TerminalTypography } from '@/components/terminal';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserCompetitionInfo {
  id: string;
  competitionId: string;
  title: string;
  status: string;
  equityCents: number;
  startingBalanceCents: number;
  rank?: number;
  totalEntrants?: number;
  prizeWonCents?: number;
  endAt?: string;
}

interface CompetitionSwitcherProps {
  currentCompetitionId: string;
  currentCompetitionTitle: string;
  currentRank?: number;
  onSwitchCompetition: (competitionId: string) => void;
}

const LAST_COMPETITION_KEY = 'last_arena_competition';

export async function getLastCompetitionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_COMPETITION_KEY);
  } catch {
    return null;
  }
}

export async function setLastCompetitionId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_COMPETITION_KEY, id);
  } catch {}
}

function getTimeRemaining(endAt: string): string {
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const diff = end - now;
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return TerminalColors.positive;
    case 'open': return TerminalColors.warning;
    case 'completed': return TerminalColors.textMuted;
    default: return TerminalColors.textMuted;
  }
}

export function CompetitionSwitcher({
  currentCompetitionId,
  currentCompetitionTitle,
  currentRank,
  onSwitchCompetition,
}: CompetitionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: userCompetitions } = useQuery<UserCompetitionInfo[]>({
    queryKey: ['/api/user/competitions'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    setLastCompetitionId(currentCompetitionId);
  }, [currentCompetitionId]);

  const handleSwitch = (competitionId: string) => {
    if (competitionId !== currentCompetitionId) {
      setLastCompetitionId(competitionId);
      onSwitchCompetition(competitionId);
    }
    setIsOpen(false);
  };

  const activeCompetitions = userCompetitions?.filter(
    uc => uc.status === 'running' || uc.status === 'open'
  ) || [];

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
        <View style={styles.triggerIcon}>
          <Feather name="layers" size={14} color={TerminalColors.accent} />
        </View>
        <View style={styles.triggerContent}>
          <ThemedText style={styles.triggerTitle} numberOfLines={1}>
            {currentCompetitionTitle}
          </ThemedText>
          {currentRank ? (
            <ThemedText style={styles.triggerRank}>Rank #{currentRank}</ThemedText>
          ) : null}
        </View>
        <Feather name="chevron-up" size={14} color={TerminalColors.textMuted} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.popover}>
            <View style={styles.popoverHeader}>
              <ThemedText style={styles.popoverTitle}>Switch Competition</ThemedText>
              <Pressable onPress={() => setIsOpen(false)}>
                <Feather name="x" size={18} color={TerminalColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {activeCompetitions.length > 0 ? (
                activeCompetitions.map((comp) => (
                  <Pressable
                    key={comp.competitionId}
                    style={[
                      styles.item,
                      comp.competitionId === currentCompetitionId && styles.itemActive,
                    ]}
                    onPress={() => handleSwitch(comp.competitionId)}
                  >
                    <View style={styles.itemMain}>
                      <View style={styles.itemHeader}>
                        <ThemedText style={styles.itemTitle} numberOfLines={1}>
                          {comp.title}
                        </ThemedText>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(comp.status) + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(comp.status) }]} />
                          <ThemedText style={[styles.statusText, { color: getStatusColor(comp.status) }]}>
                            {comp.status.toUpperCase()}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.itemMeta}>
                        {comp.endAt ? (
                          <View style={styles.metaItem}>
                            <Feather name="clock" size={11} color={TerminalColors.textMuted} />
                            <ThemedText style={styles.metaText}>
                              {getTimeRemaining(comp.endAt)}
                            </ThemedText>
                          </View>
                        ) : null}
                        {comp.rank ? (
                          <View style={styles.metaItem}>
                            <Feather name="award" size={11} color={TerminalColors.warning} />
                            <ThemedText style={styles.metaText}>#{comp.rank}</ThemedText>
                          </View>
                        ) : null}
                        {comp.totalEntrants ? (
                          <View style={styles.metaItem}>
                            <Feather name="users" size={11} color={TerminalColors.textMuted} />
                            <ThemedText style={styles.metaText}>{comp.totalEntrants}</ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {comp.competitionId === currentCompetitionId ? (
                      <Feather name="check" size={16} color={TerminalColors.accent} />
                    ) : (
                      <Feather name="chevron-right" size={16} color={TerminalColors.textMuted} />
                    )}
                  </Pressable>
                ))
              ) : (
                <View style={styles.empty}>
                  <Feather name="inbox" size={24} color={TerminalColors.textMuted} />
                  <ThemedText style={styles.emptyText}>No active competitions</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    maxWidth: 200,
  },
  triggerIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: TerminalColors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerContent: {
    flex: 1,
  },
  triggerTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: TerminalColors.textPrimary,
  },
  triggerRank: {
    fontSize: 9,
    color: TerminalColors.textMuted,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 80,
    paddingLeft: 16,
  },
  popover: {
    backgroundColor: TerminalColors.bgPanel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TerminalColors.border,
    width: 300,
    maxHeight: 350,
    overflow: 'hidden',
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    backgroundColor: TerminalColors.bgBase,
  },
  popoverTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TerminalColors.textPrimary,
  },

  list: {
    maxHeight: 280,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TerminalColors.border,
    gap: 10,
  },
  itemActive: {
    backgroundColor: TerminalColors.accent + '10',
  },
  itemMain: {
    flex: 1,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TerminalColors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: TerminalColors.textMuted,
  },
  metaLabel: {
    fontSize: 9,
    color: TerminalColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: TerminalColors.textMuted,
  },
});
