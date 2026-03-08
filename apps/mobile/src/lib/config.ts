import Constants from "expo-constants";

const fallbackIp = "192.168.1.146"; // remplace par ton IP locale actuelle

const hostUri = Constants.expoConfig?.hostUri;
const localIP = hostUri ? hostUri.split(":")[0] : fallbackIp;

export const API_URL = `http://${localIP}:3000`;
export const SOCKET_URL = `http://${localIP}:3001`;