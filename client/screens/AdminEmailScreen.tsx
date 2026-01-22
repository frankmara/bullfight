import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Switch, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/types/navigation";
import { apiRequest } from "@/lib/query-client";

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  htmlBody: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailLog {
  id: string;
  templateType: string;
  recipientEmail: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

const EMAIL_TYPE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  welcome: { label: "Welcome", description: "Sent when a new user registers", icon: "user-plus" },
  challenge_entry: { label: "Challenge Entry", description: "Sent when user joins a competition", icon: "log-in" },
  challenge_started: { label: "Challenge Started", description: "Sent when competition begins", icon: "play" },
  challenge_concluded: { label: "Challenge Concluded", description: "Sent when competition ends", icon: "flag" },
  pvp_invitation: { label: "PvP Invitation", description: "Sent to challenged traders", icon: "zap" },
  daily_standings: { label: "Daily Standings", description: "Daily leaderboard updates", icon: "bar-chart-2" },
};

export default function AdminEmailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"templates" | "logs">("templates");
  const [testEmail, setTestEmail] = useState("");
  const [testingType, setTestingType] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
    enabled: isAdmin,
  });

  const { data: logs, isLoading: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs"],
    enabled: isAdmin && activeTab === "logs",
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ type, enabled }: { type: string; enabled: boolean }) => {
      return apiRequest("PUT", `/api/admin/email-templates/${type}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ type, email }: { type: string; email: string }) => {
      return apiRequest("POST", `/api/admin/email-templates/${type}/test`, { testEmail: email });
    },
    onSuccess: () => {
      alert("Test email sent successfully!");
      setTestingType(null);
    },
    onError: (error: any) => {
      alert(`Failed to send test email: ${error.message}`);
      setTestingType(null);
    },
  });

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText style={styles.errorText}>Access Denied</ThemedText>
      </View>
    );
  }

  const handleToggle = (type: string, enabled: boolean) => {
    toggleMutation.mutate({ type, enabled });
  };

  const handleTest = (type: string) => {
    if (!testEmail) {
      alert("Please enter a test email address");
      return;
    }
    setTestingType(type);
    testMutation.mutate({ type, email: testEmail });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.title}>Email Configuration</ThemedText>
        <ThemedText style={styles.subtitle}>Manage email templates and notifications</ThemedText>
      </View>

      <View style={styles.testEmailRow}>
        <TextInput
          style={styles.testEmailInput}
          placeholder="Test email address..."
          placeholderTextColor={Colors.dark.textMuted}
          value={testEmail}
          onChangeText={setTestEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "templates" && styles.tabActive]}
          onPress={() => setActiveTab("templates")}
        >
          <ThemedText style={[styles.tabText, activeTab === "templates" && styles.tabTextActive]}>
            Templates
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "logs" && styles.tabActive]}
          onPress={() => setActiveTab("logs")}
        >
          <ThemedText style={[styles.tabText, activeTab === "logs" && styles.tabTextActive]}>
            Logs
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "templates" ? (
          templatesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.accent} />
            </View>
          ) : (
            <View style={styles.templateList}>
              {templates?.map((template) => {
                const info = EMAIL_TYPE_LABELS[template.type] || {
                  label: template.type,
                  description: "",
                  icon: "mail",
                };
                return (
                  <View key={template.id} style={styles.templateCard}>
                    <View style={styles.templateHeader}>
                      <View style={styles.templateIcon}>
                        <Feather name={info.icon as any} size={20} color={Colors.dark.accent} />
                      </View>
                      <View style={styles.templateInfo}>
                        <ThemedText style={styles.templateLabel}>{info.label}</ThemedText>
                        <ThemedText style={styles.templateDescription}>{info.description}</ThemedText>
                      </View>
                      <Switch
                        value={template.enabled}
                        onValueChange={(value) => handleToggle(template.type, value)}
                        trackColor={{ false: Colors.dark.backgroundSecondary, true: Colors.dark.success }}
                        thumbColor={template.enabled ? Colors.dark.text : Colors.dark.textMuted}
                      />
                    </View>

                    <View style={styles.templateSubject}>
                      <ThemedText style={styles.subjectLabel}>Subject:</ThemedText>
                      <ThemedText style={styles.subjectText} numberOfLines={1}>
                        {template.subject}
                      </ThemedText>
                    </View>

                    <View style={styles.templateActions}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => navigation.navigate("AdminEmailEditor", { type: template.type })}
                      >
                        <Feather name="edit-2" size={16} color={Colors.dark.accent} />
                        <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.testButton]}
                        onPress={() => handleTest(template.type)}
                        disabled={testingType === template.type}
                      >
                        {testingType === template.type ? (
                          <ActivityIndicator size="small" color={Colors.dark.success} />
                        ) : (
                          <>
                            <Feather name="send" size={16} color={Colors.dark.success} />
                            <ThemedText style={[styles.actionButtonText, { color: Colors.dark.success }]}>
                              Test
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : logsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.accent} />
          </View>
        ) : (
          <View style={styles.logList}>
            {logs?.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={48} color={Colors.dark.textMuted} />
                <ThemedText style={styles.emptyText}>No emails sent yet</ThemedText>
              </View>
            ) : (
              logs?.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View
                      style={[
                        styles.logStatus,
                        { backgroundColor: log.status === "sent" ? Colors.dark.success : Colors.dark.danger },
                      ]}
                    >
                      <ThemedText style={styles.logStatusText}>{log.status.toUpperCase()}</ThemedText>
                    </View>
                    <ThemedText style={styles.logDate}>{formatDate(log.sentAt)}</ThemedText>
                  </View>
                  <ThemedText style={styles.logEmail}>{log.recipientEmail}</ThemedText>
                  <ThemedText style={styles.logSubject} numberOfLines={1}>
                    {log.subject}
                  </ThemedText>
                  <ThemedText style={styles.logType}>
                    {EMAIL_TYPE_LABELS[log.templateType]?.label || log.templateType}
                  </ThemedText>
                  {log.errorMessage ? (
                    <ThemedText style={styles.logError}>{log.errorMessage}</ThemedText>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  testEmailRow: {
    marginBottom: Spacing.md,
  },
  testEmailInput: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.text,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing["2xl"],
  },
  templateList: {
    gap: Spacing.md,
  },
  templateCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
  },
  templateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  templateSubject: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  subjectLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginRight: Spacing.sm,
  },
  subjectText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  templateActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
  },
  testButton: {
    marginLeft: "auto",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.dark.accent,
  },
  logList: {
    gap: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyText: {
    fontSize: 16,
    color: Colors.dark.textMuted,
    marginTop: Spacing.md,
  },
  logCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  logStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  logStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.dark.text,
  },
  logDate: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  logEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: 2,
  },
  logSubject: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  logType: {
    fontSize: 12,
    color: Colors.dark.accent,
  },
  logError: {
    fontSize: 12,
    color: Colors.dark.danger,
    marginTop: Spacing.sm,
  },
});
