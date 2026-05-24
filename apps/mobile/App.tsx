import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StatusBar } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
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
import SettingsScreen from "./src/screens/SettingsScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import ChangeEmailScreen from "./src/screens/ChangeEmailScreen";
import PrivacySettingsScreen from "./src/screens/PrivacySettingsScreen";
import FollowRequestsScreen from "./src/screens/FollowRequestsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

import CreatePostScreen from "./src/screens/CreatePostScreen";
import SearchScreen from "./src/screens/SearchScreen";
import ExploreSearchScreen from "./src/screens/ExploreSearchScreen";
import CreateNoteScreen from "./src/screens/CreateNoteScreen";

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

const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef<any>();

function EmptyScreen() {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}

function stripToken(raw: string | null) {
    if (!raw) return null;
    let t = raw.trim();

    if (t.toLowerCase().startsWith("bearer ")) {
        t = t.slice(7).trim();
    }

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

function HomeNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeIndex" component={HomeScreen} />
            <HomeStack.Screen name="PostDetail" component={PostScreen} />
            <HomeStack.Screen name="UserProfile" component={UserProfileScreen} />
            <HomeStack.Screen name="FollowersList" component={FollowersListScreen} />
            <HomeStack.Screen name="FollowingList" component={FollowingListScreen} />
            <HomeStack.Screen name="SocialNotifications" component={NotificationsScreen} />
            <HomeStack.Screen name="MusicSearch" component={SearchScreen} />
            <HomeStack.Screen name="CreatePost" component={CreatePostScreen} />
            <HomeStack.Screen name="CreateNote" component={CreateNoteScreen} />
        </HomeStack.Navigator>
    );
}

function SearchNavigator() {
    return (
        <SearchStack.Navigator screenOptions={{ headerShown: false }}>
            <SearchStack.Screen name="ExploreIndex" component={ExploreSearchScreen} />
            <SearchStack.Screen name="MusicSearch" component={SearchScreen} />
            <SearchStack.Screen name="CreatePost" component={CreatePostScreen} />
            <SearchStack.Screen name="CreateNote" component={CreateNoteScreen} />
            <SearchStack.Screen name="PostDetail" component={PostScreen} />
            <SearchStack.Screen name="UserProfile" component={UserProfileScreen} />
            <SearchStack.Screen name="FollowersList" component={FollowersListScreen} />
            <SearchStack.Screen name="FollowingList" component={FollowingListScreen} />
        </SearchStack.Navigator>
    );
}

function MessagesNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="Conversations" component={ConversationsScreen} />
            <MessagesStack.Screen name="Chat" component={ChatScreen} />
            <MessagesStack.Screen name="UserProfile" component={UserProfileScreen} />
            <MessagesStack.Screen name="PostDetail" component={PostScreen} />
            <MessagesStack.Screen name="FollowersList" component={FollowersListScreen} />
            <MessagesStack.Screen name="FollowingList" component={FollowingListScreen} />
        </MessagesStack.Navigator>
    );
}

function ProfileNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileIndex" component={ProfileScreen} />
            <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
            <ProfileStack.Screen name="Settings" component={SettingsScreen} />
            <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <ProfileStack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
            <ProfileStack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
            <ProfileStack.Screen name="FollowRequests" component={FollowRequestsScreen} />
            <ProfileStack.Screen name="FollowersList" component={FollowersListScreen} />
            <ProfileStack.Screen name="FollowingList" component={FollowingListScreen} />
            <ProfileStack.Screen name="UserProfile" component={UserProfileScreen} />
            <ProfileStack.Screen name="PostDetail" component={PostScreen} />
            <ProfileStack.Screen name="SocialNotifications" component={NotificationsScreen} />
        </ProfileStack.Navigator>
    );
}

function MainTabs() {
    const insets = useSafeAreaInsets();
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

    const tabBarHeight = 62 + insets.bottom;

    return (
        <Tabs.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarActiveTintColor: "#FFFFFF",
                tabBarInactiveTintColor: "#6F6F78",
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: "800",
                    marginTop: 2,
                    paddingBottom: 0,
                },
                tabBarStyle: {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: tabBarHeight,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingHorizontal: 12,
                    borderTopWidth: 1,
                    borderTopColor: "#23232A",
                    backgroundColor: "#0F0F13",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                },
                tabBarItemStyle: {
                    borderRadius: 16,
                },
                tabBarBadgeStyle: {
                    backgroundColor: "#9B5CFF",
                    color: "#000",
                    fontWeight: "900",
                    fontSize: 10,
                    minWidth: 18,
                    height: 18,
                },
                tabBarIcon: ({ color, focused }) => {
                    let icon: keyof typeof Ionicons.glyphMap = "home-outline";

                    if (route.name === "HomeTab") icon = focused ? "home" : "home-outline";
                    if (route.name === "SearchTab") icon = focused ? "search" : "search-outline";
                    if (route.name === "CreatePostTab") icon = "add";
                    if (route.name === "MessagesTab") icon = focused ? "chatbubbles" : "chatbubbles-outline";
                    if (route.name === "ProfileTab") icon = focused ? "person" : "person-outline";

                    if (route.name === "CreatePostTab") {
                        return (
                            <View
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 19,
                                    backgroundColor: "#5E17EB",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginTop: -1,
                                    shadowColor: "#9B5CFF",
                                    shadowOpacity: 0.25,
                                    shadowRadius: 8,
                                    shadowOffset: { width: 0, height: 0 },
                                }}
                            >
                                <Ionicons name={icon} size={19} color="#fff" />
                            </View>
                        );
                    }

                    return (
                        <View
                            style={{
                                minWidth: 42,
                                height: 32,
                                borderRadius: 16,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: focused ? "#1A1327" : "transparent",
                                borderWidth: focused ? 1 : 0,
                                borderColor: focused ? "#2E2050" : "transparent",
                            }}
                        >
                            <Ionicons name={icon} size={21} color={focused ? "#FFFFFF" : color} />
                        </View>
                    );
                },
            })}
        >
            <Tabs.Screen
                name="HomeTab"
                component={HomeNavigator}
                options={{ title: "Accueil" }}
            />

            <Tabs.Screen
                name="SearchTab"
                component={SearchNavigator}
                options={{ title: "Recherche" }}
            />

            <Tabs.Screen
                name="CreatePostTab"
                component={EmptyScreen}
                options={{ title: "" }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.navigate("SearchTab", {
                            screen: "MusicSearch",
                            params: { mode: "pickTrack" },
                        });
                    },
                })}
            />

            <Tabs.Screen
                name="MessagesTab"
                component={MessagesNavigator}
                options={{
                    title: "Messages",
                    tabBarBadge:
                        messagesUnread > 0
                            ? messagesUnread > 99
                                ? "99+"
                                : messagesUnread
                            : undefined,
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

            <Tabs.Screen
                name="ProfileTab"
                component={ProfileNavigator}
                options={{ title: "Profil" }}
            />
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
                    screen: "MessagesTab",
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
                    navigationRef.navigate("Main", {
                        screen: "HomeTab",
                        params: {
                            screen: "PostDetail",
                            params: { postId: data.postId },
                        },
                    });
                    return;
                }

                if (data?.actorId) {
                    navigationRef.navigate("Main", {
                        screen: "HomeTab",
                        params: {
                            screen: "UserProfile",
                            params: { userId: data.actorId },
                        },
                    });
                }
            }
        });

        return () => {
            receivedListener.current?.remove?.();
            responseListener.current?.remove?.();
        };
    }, []);

    return null;
}

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <UserProvider>
                <PlayerProvider>
                    <NavigationContainer ref={navigationRef}>
                        <PushBootstrap />

                        <RootStack.Navigator screenOptions={{ headerShown: false }}>
                            <RootStack.Screen name="Splash" component={SplashScreen} />
                            <RootStack.Screen name="Login" component={LoginScreen} />
                            <RootStack.Screen name="Register" component={RegisterScreen} />
                            <RootStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                            <RootStack.Screen name="Main" component={MainTabs} />
                        </RootStack.Navigator>
                    </NavigationContainer>

                    <PlayerBar />
                </PlayerProvider>
            </UserProvider>
        </SafeAreaProvider>
    );
}