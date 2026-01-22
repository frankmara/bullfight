import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PvPListScreen from "@/screens/PvPListScreen";
import { Colors } from "@/constants/theme";

const Stack = createNativeStackNavigator();

export default function PvPStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.backgroundRoot },
      }}
    >
      <Stack.Screen name="PvPListMain" component={PvPListScreen} />
    </Stack.Navigator>
  );
}
