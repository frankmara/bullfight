import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { apiRequest } from "@/lib/query-client";

const { width } = Dimensions.get("window");
const isDesktop = width > 768;

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  htmlBody: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const VARIABLE_INFO: Record<string, { variables: string[]; descriptions: Record<string, string> }> = {
  welcome: {
    variables: ["userName", "userEmail", "appUrl"],
    descriptions: {
      userName: "User's display name",
      userEmail: "User's email address",
      appUrl: "Application URL",
    },
  },
  challenge_entry: {
    variables: ["userName", "competitionName", "buyInAmount", "prizePool", "startDate", "startingBalance", "arenaUrl"],
    descriptions: {
      userName: "User's display name",
      competitionName: "Name of the competition",
      buyInAmount: "Formatted buy-in amount",
      prizePool: "Current prize pool",
      startDate: "Competition start date",
      startingBalance: "Starting balance amount",
      arenaUrl: "Link to the arena",
    },
  },
  challenge_started: {
    variables: ["userName", "competitionName", "duration", "startingBalance", "arenaUrl", "participantCount"],
    descriptions: {
      userName: "User's display name",
      competitionName: "Name of the competition",
      duration: "Competition duration",
      startingBalance: "Starting balance amount",
      arenaUrl: "Link to the arena",
      participantCount: "Number of participants",
    },
  },
  challenge_concluded: {
    variables: ["userName", "competitionName", "finalRank", "totalParticipants", "finalReturn", "returnColor", "finalEquity", "winnings"],
    descriptions: {
      userName: "User's display name",
      competitionName: "Name of the competition",
      finalRank: "User's final ranking",
      totalParticipants: "Total number of participants",
      finalReturn: "User's final return percentage",
      returnColor: "Color for return (green/red)",
      finalEquity: "User's final equity",
      winnings: "Prize money won (if any)",
    },
  },
  pvp_invitation: {
    variables: ["userName", "challengerName", "stakeAmount", "duration", "startingBalance", "challengeUrl"],
    descriptions: {
      userName: "Invitee's name (or 'Trader')",
      challengerName: "Name of the challenger",
      stakeAmount: "Stake amount for the challenge",
      duration: "Challenge duration",
      startingBalance: "Starting balance amount",
      challengeUrl: "Link to view/accept challenge",
    },
  },
  daily_standings: {
    variables: ["userName", "competitionName", "currentRank", "totalParticipants", "currentReturn", "returnColor", "currentEquity", "timeRemaining", "arenaUrl", "leaderboardHtml"],
    descriptions: {
      userName: "User's display name",
      competitionName: "Name of the competition",
      currentRank: "User's current ranking",
      totalParticipants: "Total number of participants",
      currentReturn: "User's current return percentage",
      returnColor: "Color for return (green/red)",
      currentEquity: "User's current equity",
      timeRemaining: "Time remaining in competition",
      arenaUrl: "Link to the arena",
      leaderboardHtml: "HTML snippet of top leaderboard",
    },
  },
};

export default function AdminEmailEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AdminEmailEditor">>();
  const { isAdmin } = useAuthContext();
  const queryClient = useQueryClient();

  const { type } = route.params;
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: template, isLoading } = useQuery<EmailTemplate>({
    queryKey: ["/api/admin/email-templates", type],
    enabled: isAdmin,
  });

  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setHtmlBody(template.htmlBody);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/admin/email-templates/${type}`, { subject, htmlBody });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      setHasChanges(false);
      alert("Template saved successfully!");
    },
    onError: (error: any) => {
      alert(`Failed to save template: ${error.message}`);
    },
  });

  const handleSubjectChange = (text: string) => {
    setSubject(text);
    setHasChanges(true);
  };

  const handleBodyChange = (text: string) => {
    setHtmlBody(text);
    setHasChanges(true);
  };

  const insertVariable = (variable: string) => {
    const insertText = `{{${variable}}}`;
    setHtmlBody((prev) => prev + insertText);
    setHasChanges(true);
  };

  const variableInfo = VARIABLE_INFO[type] || { variables: [], descriptions: {} };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText style={styles.errorText}>Access Denied</ThemedText>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color={Colors.dark.text} />
          </Pressable>
          <ThemedText style={styles.title}>Edit {type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Template</ThemedText>
        </View>
      </View>

      <View style={isDesktop ? styles.desktopLayout : styles.mobileLayout}>
        <View style={[styles.editorSection, isDesktop && styles.editorSectionDesktop]}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Subject Line</ThemedText>
            <TextInput
              style={styles.subjectInput}
              value={subject}
              onChangeText={handleSubjectChange}
              placeholder="Email subject..."
              placeholderTextColor={Colors.dark.textMuted}
            />
          </View>

          <View style={[styles.inputGroup, styles.bodyGroup]}>
            <ThemedText style={styles.label}>HTML Body</ThemedText>
            <ScrollView style={styles.bodyScrollView} nestedScrollEnabled>
              <TextInput
                style={styles.bodyInput}
                value={htmlBody}
                onChangeText={handleBodyChange}
                placeholder="Enter HTML email body..."
                placeholderTextColor={Colors.dark.textMuted}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
          </View>
        </View>

        <View style={[styles.variablesSection, isDesktop && styles.variablesSectionDesktop]}>
          <ThemedText style={styles.variablesTitle}>Available Variables</ThemedText>
          <ThemedText style={styles.variablesHint}>Click to insert at cursor position</ThemedText>
          <ScrollView style={styles.variablesList} showsVerticalScrollIndicator={false}>
            {variableInfo.variables.map((variable) => (
              <Pressable
                key={variable}
                style={styles.variableItem}
                onPress={() => insertVariable(variable)}
              >
                <View style={styles.variableCode}>
                  <ThemedText style={styles.variableCodeText}>{`{{${variable}}}`}</ThemedText>
                </View>
                <ThemedText style={styles.variableDesc}>
                  {variableInfo.descriptions[variable] || variable}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.dark.text} />
          ) : (
            <>
              <Feather name="save" size={18} color={Colors.dark.text} />
              <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.danger,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundDefault,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.xl,
  },
  mobileLayout: {
    flex: 1,
  },
  editorSection: {
    flex: 1,
  },
  editorSectionDesktop: {
    flex: 2,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  bodyGroup: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
  },
  subjectInput: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  bodyScrollView: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  bodyInput: {
    padding: Spacing.md,
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: "monospace",
    minHeight: 300,
  },
  variablesSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  variablesSectionDesktop: {
    flex: 1,
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.border,
    paddingLeft: Spacing.xl,
  },
  variablesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  variablesHint: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.md,
  },
  variablesList: {
    flex: 1,
  },
  variableItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  variableCode: {
    backgroundColor: Colors.dark.backgroundSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  variableCodeText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: Colors.dark.accent,
  },
  variableDesc: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  footer: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dark.accent,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
});
