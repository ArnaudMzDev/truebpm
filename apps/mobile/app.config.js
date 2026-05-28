const appJson = require("./app.json");

const localApiUrl = appJson.expo.extra?.apiUrl || "http://192.168.1.25:3000";
const localSocketUrl = appJson.expo.extra?.socketUrl || "http://192.168.1.25:3001";

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || localApiUrl,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || localSocketUrl,
  },
});
