import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ProfileSetupScreen from "./src/screens/ProfileSetupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import CreatePostScreen from "./src/screens/CreatePostScreen";
import SearchScreen from "./src/screens/SearchScreen";

import PlayerBar from "./src/components/PlayerBar";
import { PlayerProvider } from "./src/context/PlayerContext";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                                 MAIN TABS                                  */
/* -------------------------------------------------------------------------- */

function MainTabs() {
    return (
        <Tabs.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#111",
                    borderTopColor: "#222",
                    height: 70,
                    paddingBottom: 12,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#9B5CFF",
                tabBarInactiveTintColor: "#777",

                tabBarIcon: ({ color, size }) => {
                    let icon = "home";

                    if (route.name === "Home") icon = "home";
                    if (route.name === "Search") icon = "search";
                    if (route.name === "CreatePost") icon = "add-circle";
                    if (route.name === "Notifications") icon = "notifications";
                    if (route.name === "ProfileTab") icon = "person";

                    return <Ionicons name={icon as any} size={26} color={color} />;
                },
            })}
        >
            <Tabs.Screen name="Home" component={HomeScreen} />
            <Tabs.Screen name="Search" component={SearchScreen} />
            <Tabs.Screen name="CreatePost" component={CreatePostScreen} />
            <Tabs.Screen
                name="Notifications"
                component={() => null} // Placeholder pour plus tard
            />
            <Tabs.Screen
                name="ProfileTab"
                component={ProfileScreen}
                options={{ title: "Profil" }}
            />
        </Tabs.Navigator>
    );
}

/* -------------------------------------------------------------------------- */
/*                                ROOT NAVIGATION                             */
/* -------------------------------------------------------------------------- */
export default function App() {
    return (
        <SafeAreaProvider>
            <PlayerProvider>
                <NavigationContainer>
                    <Stack.Navigator screenOptions={{ headerShown: false }}>
                        {/* Auth */}
                        <Stack.Screen name="Splash" component={SplashScreen} />
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

                        {/* Main app */}
                        <Stack.Screen name="Main" component={MainTabs} />

                        {/* Screens accessibles depuis le profil */}
                        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                    </Stack.Navigator>
                </NavigationContainer>

                {/* ALWAYS visible player bar */}
                <PlayerBar />
            </PlayerProvider>
        </SafeAreaProvider>
    );
}