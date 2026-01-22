import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import CompetitionDetailScreen from "@/screens/CompetitionDetailScreen";
import ArenaScreen from "@/screens/ArenaScreen";
import AdminScreen from "@/screens/AdminScreen";
import AdminCompetitionsScreen from "@/screens/AdminCompetitionsScreen";
import AdminEmailScreen from "@/screens/AdminEmailScreen";
import AdminEmailEditorScreen from "@/screens/AdminEmailEditorScreen";
import CreateCompetitionScreen from "@/screens/CreateCompetitionScreen";
import PvPListScreen from "@/screens/PvPListScreen";
import PvPNewScreen from "@/screens/PvPNewScreen";
import PvPDetailScreen from "@/screens/PvPDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          presentation: "modal",
          headerTitle: "Sign In",
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          presentation: "modal",
          headerTitle: "Create Account",
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          presentation: "modal",
          headerTitle: "Reset Password",
        }}
      />
      <Stack.Screen
        name="CompetitionDetail"
        component={CompetitionDetailScreen}
        options={{
          headerTitle: "Competition",
        }}
      />
      <Stack.Screen
        name="Arena"
        component={ArenaScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          headerTitle: "Admin",
        }}
      />
      <Stack.Screen
        name="AdminCompetitions"
        component={AdminCompetitionsScreen}
        options={{
          headerTitle: "Competitions",
        }}
      />
      <Stack.Screen
        name="AdminEmail"
        component={AdminEmailScreen}
        options={{
          headerTitle: "Email Configuration",
        }}
      />
      <Stack.Screen
        name="AdminEmailEditor"
        component={AdminEmailEditorScreen}
        options={{
          headerTitle: "Edit Template",
        }}
      />
      <Stack.Screen
        name="CreateCompetition"
        component={CreateCompetitionScreen}
        options={{
          headerTitle: "New Competition",
        }}
      />
      <Stack.Screen
        name="EditCompetition"
        component={CreateCompetitionScreen}
        options={{
          headerTitle: "Edit Competition",
        }}
      />
      <Stack.Screen
        name="PvPList"
        component={PvPListScreen}
        options={{
          headerTitle: "PvP Challenges",
        }}
      />
      <Stack.Screen
        name="PvPNew"
        component={PvPNewScreen}
        options={{
          headerTitle: "New Challenge",
        }}
      />
      <Stack.Screen
        name="PvPDetail"
        component={PvPDetailScreen}
        options={{
          headerTitle: "Challenge",
        }}
      />
    </Stack.Navigator>
  );
}
