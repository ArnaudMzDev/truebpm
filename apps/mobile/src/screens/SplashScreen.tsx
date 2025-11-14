import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";

export default function SplashScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 1100,
                useNativeDriver: true,
                easing: Easing.out(Easing.exp),
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 1100,
                useNativeDriver: true,
                easing: Easing.out(Easing.exp),
            }),
        ]).start();

        const timer = setTimeout(() => {
            navigation.replace("Login");
        }, 2200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.logoRow}>
                {/* True */}
                <Animated.Text
                    style={[
                        styles.logoText,
                        {
                            color: "#fff",
                            opacity,
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    True
                </Animated.Text>

                {/* BPM avec gradient */}
                <MaskedView
                    maskElement={
                        <Animated.Text
                            style={[
                                styles.logoText,
                                {
                                    opacity,
                                    transform: [{ translateY }],
                                },
                            ]}
                        >
                            BPM
                        </Animated.Text>
                    }
                >
                    <LinearGradient
                        colors={["#9B5CFF", "#5E17EB"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientFill}
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

    logoRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    logoText: {
        fontSize: 48,
        fontWeight: "800",
        letterSpacing: 1,
    },

    gradientFill: {
        width: 140,
        height: 60,
    },
});