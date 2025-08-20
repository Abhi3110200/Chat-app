import { router, Stack } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { useEffect } from "react";

// This component handles the routing based on auth state
function RootLayoutNav() {
  const { user, authToken, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // Wait until auth state is loaded

    if (!user || !authToken) {
      router.replace("/login");
    } else {
      router.replace("/");
    }
  }, [user, authToken, loading]);

  // Show nothing while checking auth state
  if (loading) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false ,animation: "ios_from_right" }}/>
}

// Main layout component that provides the Auth context
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}