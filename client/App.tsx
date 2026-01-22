import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { RootStackParamList } from "@/types/navigation";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL("/"),
    "https://bullfight.replit.app",
    `https://${process.env.EXPO_PUBLIC_DOMAIN || ""}`.replace(":5000", ""),
  ],
  config: {
    screens: {
      Main: "",
      Login: "login",
      Register: "register",
      ForgotPassword: "forgot-password",
      CompetitionDetail: "competition/:id",
      Arena: "arena/:id",
      Admin: "admin",
      AdminCompetitions: "admin/competitions",
      AdminEmail: "admin/email",
      AdminEmailEditor: "admin/email/:type",
      CreateCompetition: "admin/competitions/new",
      EditCompetition: "admin/competitions/:id/edit",
      PvPList: "pvp",
      PvPNew: "pvp/new",
      PvPDetail: "pvp/:id",
      PaymentSuccess: "payment/success",
      PaymentCancel: "payment/cancel",
    },
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <NavigationContainer linking={linking}>
                  <RootStackNavigator />
                </NavigationContainer>
                <StatusBar style="light" />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
