// App.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";

import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ProfileSetupScreen from "./src/screens/ProfileSetupScreen";

import HomeScreen from "./src/screens/HomeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

import CreatePostScreen from "./src/screens/CreatePostScreen";
import SearchScreen from "./src/screens/SearchScreen";
import ExploreSearchScreen from "./src/screens/ExploreSearchScreen";

import UserProfileScreen from "./src/screens/UserProfileScreen";
import FollowersListScreen from "./src/screens/FollowersListScreen";
import FollowingListScreen from "./src/screens/FollowingListScreen";
import PostScreen from "./src/screens/PostScreen";

import ConversationsScreen from "./src/screens/ConversationsScreen";
import ChatScreen from "./src/screens/ChatScreen";

import PlayerBar from "./src/components/PlayerBar";
import { PlayerProvider } from "./src/context/PlayerContext";
import { UserProvider } from "./src/context/UserContext";
import { registerPushTokenOnBackend } from "./src/lib/pushNotifications";
import { API_URL, SOCKET_URL } from "./src/lib/config";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MessagesStack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef<any>();

function EmptyScreen() {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}

function stripToken(raw: string | null) {
    if (!raw) return null;
    let t = raw.trim();
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
    if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
    ) {
        t = t.slice(1, -1).trim();
    }
    return t || null;
}

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        console.log("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

function MessagesNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="Conversations" component={ConversationsScreen} />
            <MessagesStack.Screen name="Chat" component={ChatScreen} />
        </MessagesStack.Navigator>
    );
}

function MainTabs() {
    const [messagesUnread, setMessagesUnread] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    const fetchMessagesUnread = useCallback(async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
            setMessagesUnread(0);
            return;
        }

        const res = await fetch(`${API_URL}/api/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const json = await safeJson(res);
        if (!res.ok) {
            setMessagesUnread(0);
            return;
        }

        const conversations = Array.isArray(json?.conversations) ? json.conversations : [];
        const total = conversations.reduce(
            (sum: number, c: any) => sum + Math.max(0, Number(c?.unreadCount || 0)),
            0
        );

        setMessagesUnread(total);
    }, []);

    useEffect(() => {
        fetchMessagesUnread().catch(() => {});
    }, [fetchMessagesUnread]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const stored = await AsyncStorage.getItem("token");
            const rawToken = stripToken(stored);
            if (!rawToken) return;

            const s = io(SOCKET_URL, {
                transports: ["websocket", "polling"],
                auth: { token: rawToken },
                reconnection: true,
            });

            socketRef.current = s;

            s.on("conversations:invalidate", async () => {
                if (!alive) return;
                await fetchMessagesUnread();
            });

            s.on("connect", () => {
                console.log("tabs socket connected", s.id);
            });
        })();

        return () => {
            alive = false;
            const s = socketRef.current;
            if (s) {
                s.removeAllListeners();
                s.disconnect();
            }
            socketRef.current = null;
        };
    }, [fetchMessagesUnread]);

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
                tabBarBadgeStyle: {
                    backgroundColor: "#9B5CFF",
                    color: "#000",
                    fontWeight: "900",
                },
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

            <Tabs.Screen
                name="Notifications"
                component={MessagesNavigator}
                options={{
                    title: "Messages",
                    tabBarBadge: messagesUnread > 0 ? (messagesUnread > 99 ? "99+" : messagesUnread) : undefined,
                }}
                listeners={{
                    tabPress: () => {
                        setMessagesUnread(0);

                        setTimeout(() => {
                            fetchMessagesUnread().catch(() => {});
                        }, 250);
                    },
                }}
            />

            <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profil" }} />
        </Tabs.Navigator>
    );
}

function PushBootstrap() {
    const responseListener = useRef<any>(null);
    const receivedListener = useRef<any>(null);

    useEffect(() => {
        registerPushTokenOnBackend().catch((e) => {
            console.log("registerPushTokenOnBackend error:", e);
        });

        receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log("push received:", notification.request.content.data);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data: any = response.notification.request.content.data || {};

            if (!navigationRef.isReady()) return;

            if (data?.type === "message" && data?.conversationId) {
                navigationRef.navigate("Main", {
                    screen: "Notifications",
                    params: {
                        screen: "Chat",
                        params: {
                            conversationId: data.conversationId,
                        },
                    },
                });
                return;
            }

            if (data?.type === "social") {
                if (data?.postId) {
                    navigationRef.navigate("PostDetail", { postId: data.postId });
                    return;
                }
                if (data?.actorId) {
                    navigationRef.navigate("UserProfile", { userId: data.actorId });
                }
            }
        });

        return () => {
            if (receivedListener.current) {
                Notifications.removeNotificationSubscription(receivedListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    return null;
}

export default function App() {
    return (
        <SafeAreaProvider>
            <UserProvider>
                <PlayerProvider>
                    <NavigationContainer ref={navigationRef}>
                        <PushBootstrap />

                        <Stack.Navigator screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="Splash" component={SplashScreen} />
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="Register" component={RegisterScreen} />
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

                            <Stack.Screen name="FollowersList" component={FollowersListScreen} />
                            <Stack.Screen name="FollowingList" component={FollowingListScreen} />

                            <Stack.Screen name="Main" component={MainTabs} />

                            <Stack.Screen name="MusicSearch" component={SearchScreen} />
                            <Stack.Screen name="CreatePost" component={CreatePostScreen} />
                            <Stack.Screen name="PostDetail" component={PostScreen} />
                            <Stack.Screen name="SocialNotifications" component={NotificationsScreen} />

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