import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="buildings" options={{ title: "Buildings" }} />
      <Stack.Screen name="floors" options={{ title: "Floors" }} />
      <Stack.Screen name="rooms" options={{ title: "Rooms" }} />
    </Stack>
  )
}

export default Layout;