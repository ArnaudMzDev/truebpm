// apps/mobile/src/screens/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type SplashNav = NativeStackNavigationProp<RootStackParamList, "Splash">;

export default function SplashScreen() {
    const navigation = useNavigation<SplashNav>();

    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // Animation logo
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

        // Auto-login
        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem("token");

                setTimeout(() => {
                    if (token) {
                        navigation.replace("Main"); // ou "Home" selon ton Stack
                    } else {
                        navigation.replace("Login");
                    }
                }, 1800);
            } catch (e) {
                console.log("Splash token check error:", e);
                navigation.replace("Login");
            }
        };

        checkToken();
    }, [navigation]);

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