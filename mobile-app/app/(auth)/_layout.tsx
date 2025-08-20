import { Stack } from "expo-router";

const AuthLayout = () => {
    return (
        <Stack screenOptions={{ animation: "ios_from_right" }}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack>
    );
};

export default AuthLayout;