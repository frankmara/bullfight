import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PvPListScreen from "@/screens/PvPListScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

const Stack = createNativeStackNavigator();

export default function PvPStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="PvPListMain"
        component={PvPListScreen}
        options={{
          headerTitle: () => <HeaderTitle title="PvP" />,
        }}
      />
    </Stack.Navigator>
  );
}
