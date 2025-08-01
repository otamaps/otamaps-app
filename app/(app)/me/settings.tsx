import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";

const Settings = () => {
  const [locationPermission, setLocationPermission] = useState<boolean | null>(
    null
  );
  const [backgroundLocationPermission, setBackgroundLocationPermission] =
    useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    boolean | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("isDebugMode").then((value) => {
      if (value !== null) setIsDebugMode(value === "true");
    });
  }, []);

  const handleDebugModeChange = async (value: boolean) => {
    setIsDebugMode(value);
    await AsyncStorage.setItem("isDebugMode", value.toString());
  };

  const checkPermissions = async () => {
    try {
      // Check foreground location permission
      const { status: locationStatus } =
        await Location.getForegroundPermissionsAsync();
      setLocationPermission(locationStatus === "granted");

      // Check background location permission
      if (locationStatus === "granted") {
        if (Platform.OS === "android") {
          const androidPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
          );
          setBackgroundLocationPermission(androidPermission);
        } else if (Platform.OS === "ios") {
          const { status: backgroundStatus } =
            await Location.getBackgroundPermissionsAsync();
          setBackgroundLocationPermission(backgroundStatus === "granted");
        }
      } else {
        setBackgroundLocationPermission(false);
      }

      // Check notification permission
      const { status: notificationStatus } =
        await Notifications.getPermissionsAsync();
      setNotificationPermission(notificationStatus === "granted");
    } catch (error) {
      console.error("Error checking permissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      // First request foreground location
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setLocationPermission(granted);

      if (granted && Platform.OS === "android") {
        // On Android, we need to request background location separately
        const backgroundGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
          {
            title: "Taustasijainnin käyttöoikeus",
            message:
              "Salli sovelluksen käyttää sijaintia taustalla paremman käyttökokemuksen saamiseksi.",
            buttonNeutral: "Kysy myöhemmin",
            buttonNegative: "Hylkää",
            buttonPositive: "Salli",
          }
        );
        setBackgroundLocationPermission(
          backgroundGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      } else if (granted && Platform.OS === "ios") {
        // On iOS, request background location
        const { status: backgroundStatus } =
          await Location.requestBackgroundPermissionsAsync();
        setBackgroundLocationPermission(backgroundStatus === "granted");
      } else {
        setBackgroundLocationPermission(false);
      }

      return granted;
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status === "granted");
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4A89EE" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <Stack.Screen
        options={{
          title: "Asetukset",
          headerStyle: {
            backgroundColor: isDark ? "#1e1e1e" : "#fff",
          },
          headerTitleStyle: {
            color: isDark ? "#fff" : "#000",
          },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#4A89EE" />
            </Pressable>
          ),
        }}
      />
      <View
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={[styles.section, isDark && { backgroundColor: "#303030" }]}
        >
          <Text style={[styles.sectionTitle, isDark && { color: "white" }]}>
            Käyttöoikeudet
          </Text>

          <View
            style={[
              styles.settingItem,
              isDark && { borderBottomColor: "#454545" },
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[styles.settingTitle, isDark && { color: "#e5e5e5" }]}
              >
                Sijainti
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  isDark && { color: "#737373" },
                ]}
              >
                Tarvitaan kartan ja sijainnin näyttämiseen
              </Text>
            </View>
            {locationPermission === null ? (
              <ActivityIndicator size="small" color="#4A89EE" />
            ) : (
              <Pressable
                style={[
                  styles.permissionButton,
                  locationPermission
                    ? styles.permissionGranted
                    : styles.permissionDenied,
                ]}
                onPress={requestLocationPermission}
              >
                <Text style={styles.permissionButtonText}>
                  {locationPermission ? "Myönnetty" : "Anna oikeudet"}
                </Text>
              </Pressable>
            )}
          </View>

          <View
            style={[
              styles.settingItem,
              isDark && { borderBottomColor: "#454545" },
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[styles.settingTitle, isDark && { color: "#e5e5e5" }]}
              >
                Taustasijainti
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  isDark && { color: "#737373" },
                ]}
              >
                Salli sovelluksen käyttää sijaintia taustalla
              </Text>
            </View>
            {backgroundLocationPermission === null ? (
              <ActivityIndicator size="small" color="#4A89EE" />
            ) : (
              <Pressable
                style={[
                  styles.permissionButton,
                  backgroundLocationPermission
                    ? styles.permissionGranted
                    : styles.permissionDenied,
                ]}
                onPress={requestLocationPermission}
                disabled={!locationPermission}
              >
                <Text
                  style={[
                    styles.permissionButtonText,
                    !locationPermission && { opacity: 0.5 },
                  ]}
                >
                  {backgroundLocationPermission
                    ? "Myönnetty"
                    : locationPermission
                    ? "Anna oikeudet"
                    : "Vaaditaan sijainti"}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={styles.settingTextContainer}>
              <Text
                style={[styles.settingTitle, isDark && { color: "#e5e5e5" }]}
              >
                Ilmoitukset
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  isDark && { color: "#737373" },
                ]}
              >
                Salli sovelluksen lähettää ilmoituksia
              </Text>
            </View>
            {notificationPermission === null ? (
              <ActivityIndicator size="small" color="#4A89EE" />
            ) : (
              <Pressable
                style={[
                  styles.permissionButton,
                  notificationPermission
                    ? styles.permissionGranted
                    : styles.permissionDenied,
                ]}
                onPress={requestNotificationPermission}
              >
                <Text style={styles.permissionButtonText}>
                  {notificationPermission ? "Myönnetty" : "Anna oikeudet"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View
          style={[styles.section, isDark && { backgroundColor: "#303030" }]}
        >
          <Text style={[styles.sectionTitle, isDark && { color: "white" }]}>
            Asetukset
          </Text>

          <View
            style={[
              styles.settingItem,
              isDark && { borderBottomColor: "#454545" },
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[styles.settingTitle, isDark && { color: "#e5e5e5" }]}
              >
                Tumma tila
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  isDark && { color: "#737373" },
                ]}
              >
                Vaihda sovelluksen väriteemaa
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#767577", true: "#4A89EE" }}
              thumbColor={darkMode ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

          <View
            style={[
              styles.settingItem,
              isDark && { borderBottomColor: "#454545" },
            ]}
          >
            <View style={styles.settingTextContainer}>
              <Text
                style={[styles.settingTitle, isDark && { color: "#e5e5e5" }]}
              >
                Debug tila
              </Text>
            </View>
            <Switch
              value={isDebugMode}
              onValueChange={handleDebugModeChange}
              trackColor={{ false: "#767577", true: "#4A89EE" }}
              thumbColor={isDebugMode ? "#f4f3f4" : "#f4f3f4"}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.optionContainer,
              pressed && styles.optionContainerPressed,
            ]}
            onPress={() => router.push("/me/privacy")}
          >
            <Text style={[styles.settingTitle, isDark && { color: "white" }]}>
              Tietosuoja
            </Text>
          </Pressable>
          <View
            style={[styles.separator, isDark && { backgroundColor: "#454545" }]}
          />

          <Pressable
            style={({ pressed }) => [
              styles.optionContainer,
              pressed && styles.optionContainerPressed,
            ]}
            onPress={() => router.push("/me/terms")}
          >
            <Text style={[styles.settingTitle, isDark && { color: "white" }]}>
              Käyttöehdot
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Figtree-Bold",
    color: "#333",
    paddingVertical: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontFamily: "Figtree-SemiBold",
    color: "#333",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: "Figtree-Regular",
    color: "#666",
  },
  permissionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionGranted: {
    backgroundColor: "#e8f0fe",
  },
  permissionDenied: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  permissionButtonText: {
    fontSize: 14,
    fontFamily: "Figtree-SemiBold",
  },
  optionContainer: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionContainerPressed: {
    opacity: 0.7,
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginLeft: 4,
  },
});

export default Settings;
