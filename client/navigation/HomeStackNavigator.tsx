import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "@/screens/LandingScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HomeStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Bullfight" />,
        }}
      />
    </Stack.Navigator>
  );
}
