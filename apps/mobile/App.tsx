// App.tsx
import React from "react";
import { View } from "react-native";
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
import SearchScreen from "./src/screens/SearchScreen"; // MUSIQUE
import ExploreSearchScreen from "./src/screens/ExploreSearchScreen"; // GLOBAL

import UserProfileScreen from "./src/screens/UserProfileScreen";
import FollowersListScreen from "./src/screens/FollowersListScreen";
import FollowingListScreen from "./src/screens/FollowingListScreen";
import PostScreen from "./src/screens/PostScreen";

// ✅ MESSAGERIE
import ConversationsScreen from "./src/screens/ConversationsScreen";
import ChatScreen from "./src/screens/ChatScreen";

import PlayerBar from "./src/components/PlayerBar";
import { PlayerProvider } from "./src/context/PlayerContext";
import { UserProvider } from "./src/context/UserContext";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MessagesStack = createNativeStackNavigator();

function EmptyScreen() {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}

/* -------------------------------------------------------------------------- */
/*                                MESSAGES STACK                              */
/* -------------------------------------------------------------------------- */

function MessagesNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="Conversations" component={ConversationsScreen} />
            <MessagesStack.Screen name="Chat" component={ChatScreen} />
        </MessagesStack.Navigator>
    );
}

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
                tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },

                tabBarIcon: ({ color }) => {
                    let icon: keyof typeof Ionicons.glyphMap = "home";

                    if (route.name === "Home") icon = "home";
                    if (route.name === "ExploreSearch") icon = "search";
                    if (route.name === "CreatePostTab") icon = "add-circle";
                    if (route.name === "Notifications") icon = "chatbubbles";
                    if (route.name === "ProfileTab") icon = "person";

                    return <Ionicons name={icon} size={26} color={color} />;
                },
            })}
        >
            <Tabs.Screen name="Home" component={HomeScreen} options={{ title: "Accueil" }} />

            <Tabs.Screen
                name="ExploreSearch"
                component={ExploreSearchScreen}
                options={{ title: "Recherche" }}
            />

            <Tabs.Screen
                name="CreatePostTab"
                component={EmptyScreen}
                options={{ title: "Créer" }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.navigate("MusicSearch" as never, { mode: "pickTrack" } as never);
                    },
                })}
            />

            {/* ✅ Messages (remplace Notif) */}
            <Tabs.Screen
                name="Notifications"
                component={MessagesNavigator}
                options={{ title: "Messages" }}
            />

            <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profil" }} />
        </Tabs.Navigator>
    );
}

/* -------------------------------------------------------------------------- */
/*                                ROOT NAVIGATION                             */
/* -------------------------------------------------------------------------- */

export default function App() {
    return (
        <SafeAreaProvider>
            <UserProvider>
                <PlayerProvider>
                    <NavigationContainer>
                        <Stack.Navigator screenOptions={{ headerShown: false }}>
                            {/* Auth */}
                            <Stack.Screen name="Splash" component={SplashScreen} />
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="Register" component={RegisterScreen} />
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

                            {/* Lists */}
                            <Stack.Screen name="FollowersList" component={FollowersListScreen} />
                            <Stack.Screen name="FollowingList" component={FollowingListScreen} />

                            {/* Main */}
                            <Stack.Screen name="Main" component={MainTabs} />

                            {/* Recherche MUSIQUE (hors tab) */}
                            <Stack.Screen name="MusicSearch" component={SearchScreen} />

                            {/* Create post */}
                            <Stack.Screen name="CreatePost" component={CreatePostScreen} />
                            <Stack.Screen name="PostDetail" component={PostScreen} />

                            {/* Profil */}
                            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                        </Stack.Navigator>
                    </NavigationContainer>

                    <PlayerBar />
                </PlayerProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}