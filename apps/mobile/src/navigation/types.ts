export type RootStackParamList = {
    Splash: undefined;
    Login: undefined;
    Register: undefined;
    Legal: { document?: "terms" | "privacy" | "community" | "sales" } | undefined;
    ProfileSetup: undefined;
    Main: undefined;
    Home: undefined;
    Profile: { userId?: string } | undefined;
    EditProfile: undefined;
    DeleteAccount: undefined;
    Support: undefined;
    Feedback: undefined;
    CreatePost: undefined;
    Search: undefined;
};
