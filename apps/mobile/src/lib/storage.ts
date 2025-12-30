import AsyncStorage from "@react-native-async-storage/async-storage";

export async function mergeStoredUser(partial: any) {
    const raw = await AsyncStorage.getItem("user");
    const prev = raw ? JSON.parse(raw) : {};

    const next = {
        ...prev,
        ...partial,
    };

    await AsyncStorage.setItem("user", JSON.stringify(next));
    return next;
}