import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";
import { API_URL } from "../lib/config";
type SplashNav = NativeStackNavigationProp<RootStackParamList, "Splash">;

async function safeJson(res: Response): Promise<any | null> {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        console.log("Splash non-JSON response:", text.slice(0, 200));
        return null;
    }
}

export default function SplashScreen() {
    const navigation = useNavigation<SplashNav>();

    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
                easing: Easing.out(Easing.exp),
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 1200,
                useNativeDriver: true,
                easing: Easing.out(Easing.exp),
            }),
        ]).start();

        const bootstrap = async () => {
            const minDelay = new Promise((r) => setTimeout(r, 900));

            try {
                const token = await AsyncStorage.getItem("token");

                if (!token) {
                    await minDelay;
                    navigation.replace("Login");
                    return;
                }

                const res = await fetch(`${API_URL}/api/user/me`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                });

                // Token invalide
                if (res.status === 401 || res.status === 403) {
                    await AsyncStorage.multiRemove(["token", "user"]);
                    await minDelay;
                    navigation.replace("Login");
                    return;
                }

                const json = await safeJson(res);

                // Backend KO / mauvaise réponse
                if (!res.ok || !json?.user?._id) {
                    await AsyncStorage.multiRemove(["token", "user"]);
                    await minDelay;
                    navigation.replace("Login");
                    return;
                }

                await AsyncStorage.setItem("user", JSON.stringify(json.user));

                await minDelay;
                navigation.replace("Main");
            } catch (e) {
                console.log("Splash bootstrap error:", e);
                await AsyncStorage.multiRemove(["token", "user"]);
                await minDelay;
                navigation.replace("Login");
            }
        };

        bootstrap();
    }, [navigation, opacity, translateY]);

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Animated.Text
                    style={[
                        styles.logoText,
                        { color: "white", opacity, transform: [{ translateY }] },
                    ]}
                >
                    True
                </Animated.Text>

                <MaskedView
                    maskElement={
                        <Animated.Text
                            style={[
                                styles.logoText,
                                { opacity, transform: [{ translateY }] },
                            ]}
                        >
                            BPM
                        </Animated.Text>
                    }
                >
                    <LinearGradient
                        colors={["#9B5CFF", "#5E17EB"]}
                        style={{ width: 120, height: 60 }}
                    />
                </MaskedView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    logoText: {
        fontSize: 48,
        fontWeight: "800",
        letterSpacing: 1,
    },
});