export const blindTestFlags = {
    global: process.env.BLIND_TEST_ENABLED !== "false",
    daily: process.env.BLIND_TEST_DAILY_ENABLED === "true",
    challenges: process.env.BLIND_TEST_CHALLENGES_ENABLED === "true",
    personalization: process.env.BLIND_TEST_PERSONALIZATION_ENABLED === "true",
    profile: process.env.BLIND_TEST_PROFILE_ENABLED === "true",
    survival: process.env.BLIND_TEST_SURVIVAL_ENABLED === "true",
    multiplayer: process.env.BLIND_TEST_MULTIPLAYER_ENABLED === "true",
    community: process.env.BLIND_TEST_COMMUNITY_ENABLED === "true",
    ranked: process.env.BLIND_TEST_RANKED_ENABLED === "true",
};
