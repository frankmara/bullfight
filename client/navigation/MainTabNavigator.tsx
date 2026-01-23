import React, { useState, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Pressable, Dimensions } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import DashboardStackNavigator from "@/navigation/DashboardStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import PvPStackNavigator from "@/navigation/PvPStackNavigator";
import LandingScreen from "@/screens/LandingScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import PvPListScreen from "@/screens/PvPListScreen";
import { Colors, Spacing } from "@/constants/theme";
import { MainTabParamList } from "@/types/navigation";
import { useAuth } from "@/hooks/useAuth";
import { WalletBadge } from "@/components/WalletBadge";

const Tab = createBottomTabNavigator<MainTabParamList>();

const DESKTOP_BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (Platform.OS !== 'web') return false;
    return Dimensions.get('window').width >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsDesktop(window.width >= DESKTOP_BREAKPOINT);
    });

    return () => subscription?.remove();
  }, []);

  return isDesktop;
}

interface NavItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function NavItem({ icon, label, isActive, onPress }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        isActive && styles.navItemActive,
        pressed && styles.navItemPressed,
      ]}
    >
      <Feather 
        name={icon} 
        size={18} 
        color={isActive ? Colors.dark.accent : Colors.dark.textSecondary} 
      />
      <Text style={[
        styles.navLabel,
        isActive && styles.navLabelActive
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DesktopNavBar({ activeTab, onTabChange }: { 
  activeTab: string; 
  onTabChange: (tab: string) => void;
}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  return (
    <View style={styles.desktopNav}>
      <View style={styles.navLeft}>
        <Pressable 
          onPress={() => onTabChange('HomeTab')}
          style={styles.logoContainer}
        >
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🐂</Text>
          </View>
          <Text style={styles.logoText}>Bullfight</Text>
        </Pressable>
        
        <View style={styles.navItems}>
          <NavItem
            icon="trending-up"
            label="Competitions"
            isActive={activeTab === 'HomeTab'}
            onPress={() => onTabChange('HomeTab')}
          />
          <NavItem
            icon="grid"
            label="Dashboard"
            isActive={activeTab === 'DashboardTab'}
            onPress={() => onTabChange('DashboardTab')}
          />
          <NavItem
            icon="users"
            label="PvP"
            isActive={false}
            onPress={() => navigation.navigate('PvPList')}
          />
          <NavItem
            icon="user"
            label="Profile"
            isActive={activeTab === 'ProfileTab'}
            onPress={() => onTabChange('ProfileTab')}
          />
        </View>
      </View>

      <View style={styles.navRight}>
        {user ? (
          <>
            <WalletBadge onPress={() => navigation.navigate('Wallet')} />
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitial}>
                  {user.email?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.signInButton,
              pressed && styles.signInButtonPressed,
            ]}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DesktopLayout() {
  const [activeTab, setActiveTab] = useState('HomeTab');

  const renderContent = () => {
    switch (activeTab) {
      case 'DashboardTab':
        return <DashboardScreen />;
      case 'ProfileTab':
        return <ProfileScreen />;
      default:
        return <LandingScreen />;
    }
  };

  return (
    <View style={styles.desktopContainer}>
      <DesktopNavBar activeTab={activeTab} onTabChange={setActiveTab} />
      <View style={styles.desktopContent}>
        {renderContent()}
      </View>
    </View>
  );
}

function MobileTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.tabIconSelected,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.dark.backgroundSecondary,
            web: Colors.dark.backgroundSecondary,
          }),
          borderTopWidth: 1,
          borderTopColor: Colors.dark.border,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Compete",
          tabBarIcon: ({ color, size }) => (
            <Feather name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PvPTab"
        component={PvPStackNavigator}
        options={{
          title: "PvP",
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <DesktopLayout />;
  }

  return <MobileTabNavigator />;
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 59, 59, 0.1)',
  },
  navItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
  },
  navLabelActive: {
    color: Colors.dark.accent,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    maxWidth: 150,
  },
  signInButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dark.accent,
    borderRadius: 8,
  },
  signInButtonPressed: {
    backgroundColor: '#CC3030',
  },
  signInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  desktopContent: {
    flex: 1,
  },
});
