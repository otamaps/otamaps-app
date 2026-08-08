import {
  isBLEBackgroundEnabled,
  setBLEBackgroundEnabled,
  stopBLEBackgroundService,
} from "@/lib/bleBackgroundManager";
import { requestBleTrackingPermissions } from "@/lib/blePermissions";
import { startForegroundTracking, stopAllTracking } from "@/lib/bleTrackingRuntime";
import { supabase } from "@/lib/supabase";
import {
  getUserPreferences,
  updateConsentChoices,
} from "@/lib/userPreferences";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [friendLocation, setFriendLocation] = useState(false);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const isDark = useColorScheme() === "dark";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [preferences, backgroundEnabled, notification, debugMode] =
          await Promise.all([
            getUserPreferences({ forceRefresh: true }),
            isBLEBackgroundEnabled(),
            Notifications.getPermissionsAsync(),
            AsyncStorage.getItem("isDebugMode"),
          ]);
        if (cancelled) return;
        setFriendLocation(preferences.friend_location_enabled);
        setAnonymousAnalytics(preferences.anonymous_analytics_enabled);
        setBackgroundTracking(
          preferences.background_tracking_enabled && backgroundEnabled
        );
        setNotificationPermission(notification.status === "granted");
        setIsDebugMode(debugMode === "true");
      } catch (error) {
        Alert.alert(
          "Asetuksia ei voitu ladata",
          error instanceof Error ? error.message : "Yritä uudelleen."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureForegroundTracking = async () => {
    const permission = await requestBleTrackingPermissions(false);
    if (!permission.success) return false;
    return (await startForegroundTracking()).success;
  };

  const changeFriendLocation = async (enabled: boolean) => {
    setUpdating("friend");
    try {
      const preferences = await updateConsentChoices({
        friend_location_enabled: enabled,
      });
      setFriendLocation(preferences.friend_location_enabled);
      if (!enabled) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await supabase.from("locations").delete().eq("user_id", session.user.id);
        }
      }
      if (enabled) await ensureForegroundTracking();
      if (!enabled && !anonymousAnalytics) await disableAllTracking();
    } catch (error) {
      Alert.alert("Asetusta ei voitu tallentaa", errorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const changeAnonymousAnalytics = async (enabled: boolean) => {
    setUpdating("analytics");
    try {
      const preferences = await updateConsentChoices({
        anonymous_analytics_enabled: enabled,
      });
      setAnonymousAnalytics(preferences.anonymous_analytics_enabled);
      if (enabled) await ensureForegroundTracking();
      if (!enabled && !friendLocation) await disableAllTracking();
    } catch (error) {
      Alert.alert("Asetusta ei voitu tallentaa", errorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const disableAllTracking = async () => {
    await updateConsentChoices({ background_tracking_enabled: false });
    setBackgroundTracking(false);
    await stopBLEBackgroundService();
    await stopAllTracking(true);
  };

  const changeBackgroundTracking = async (enabled: boolean) => {
    if (!friendLocation && !anonymousAnalytics) return;
    setUpdating("background");
    try {
      if (!enabled) {
        await setBLEBackgroundEnabled(false);
        await updateConsentChoices({ background_tracking_enabled: false });
        setBackgroundTracking(false);
        return;
      }
      const result = await setBLEBackgroundEnabled(true);
      if (!result?.success) {
        throw new Error(
          result?.reason === "bluetooth_off"
            ? "Kytke Bluetooth päälle ja yritä uudelleen."
            : "Tarkista Bluetooth- ja sijaintioikeudet laitteen asetuksista."
        );
      }
      await updateConsentChoices({ background_tracking_enabled: true });
      setBackgroundTracking(true);
    } catch (error) {
      setBackgroundTracking(false);
      await updateConsentChoices({ background_tracking_enabled: false }).catch(
        () => undefined
      );
      Alert.alert("Taustapaikannusta ei voitu ottaa käyttöön", errorMessage(error), [
        { text: "Avaa asetukset", onPress: () => Linking.openSettings() },
        { text: "Sulje", style: "cancel" },
      ]);
    } finally {
      setUpdating(null);
    }
  };

  const changeNotifications = async (enabled: boolean) => {
    if (!enabled) {
      await Linking.openSettings();
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    setNotificationPermission(result.status === "granted");
  };

  const changeDebugMode = async (enabled: boolean) => {
    setIsDebugMode(enabled);
    await AsyncStorage.setItem("isDebugMode", enabled.toString());
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3478F5" />
      </View>
    );
  }

  const surface = isDark ? "#252525" : "#FFFFFF";
  const background = isDark ? "#1E1E1E" : "#F5F7FA";
  const titleColor = isDark ? "#FFFFFF" : "#101828";
  const descriptionColor = isDark ? "#B3B3B3" : "#667085";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <Stack.Screen
        options={{
          title: "Asetukset",
          headerStyle: { backgroundColor: surface },
          headerTitleStyle: { color: titleColor },
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={titleColor} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionLabel, { color: descriptionColor }]}>TIETOSUOJA</Text>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <SettingSwitch
            title="Sijainti kavereille"
            description="Näytä sijaintisi vain hyväksytyille kavereillesi."
            value={friendLocation}
            disabled={updating !== null}
            onValueChange={(value) => void changeFriendLocation(value)}
            colors={{ titleColor, descriptionColor }}
          />
          <Divider isDark={isDark} />
          <SettingSwitch
            title="Anonyymit ruuhka-arviot"
            description="Lähetä karkea tila- ja aikatieto ilman käyttäjätunnusta, luokkaa tai tarkkoja koordinaatteja."
            value={anonymousAnalytics}
            disabled={updating !== null}
            onValueChange={(value) => void changeAnonymousAnalytics(value)}
            colors={{ titleColor, descriptionColor }}
          />
          {(Platform.OS === "android" || Platform.OS === "ios") && (
            <>
              <Divider isDark={isDark} />
              <SettingSwitch
                title="Taustapaikannus"
                description="Tunnista koulun majakoita myös silloin, kun OtaMaps ei ole näkyvissä."
                value={backgroundTracking}
                disabled={
                  updating !== null || (!friendLocation && !anonymousAnalytics)
                }
                onValueChange={(value) => void changeBackgroundTracking(value)}
                colors={{ titleColor, descriptionColor }}
              />
            </>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: descriptionColor }]}>SOVELLUS</Text>
        <View style={[styles.card, { backgroundColor: surface }]}>
          <SettingSwitch
            title="Ilmoitukset"
            description="Wilma-viestit, muutokset ja kaveripyynnöt."
            value={notificationPermission}
            onValueChange={(value) => void changeNotifications(value)}
            colors={{ titleColor, descriptionColor }}
          />
          <Divider isDark={isDark} />
          <SettingSwitch
            title="Debug-tila"
            description="Näytä kehittäjätoiminnot."
            value={isDebugMode}
            onValueChange={(value) => void changeDebugMode(value)}
            colors={{ titleColor, descriptionColor }}
          />
        </View>

        <View style={[styles.card, { backgroundColor: surface }]}>
          <LinkRow
            title="Käy onboarding uudelleen"
            onPress={() => router.push("/welcome/(post)/permissions")}
            color={titleColor}
          />
          <Divider isDark={isDark} />
          <LinkRow
            title="Tietosuoja"
            onPress={() => Linking.openURL("https://otamaps.fi/privacy")}
            color={titleColor}
          />
          <Divider isDark={isDark} />
          <LinkRow
            title="Käyttöehdot"
            onPress={() => Linking.openURL("https://otamaps.fi/terms")}
            color={titleColor}
          />
        </View>

        <Pressable
          style={styles.deleteButton}
          onPress={() => Linking.openURL("https://otamaps.fi/remove-me")}
        >
          <Text style={styles.deleteText}>Poista tili</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen.";
}

function SettingSwitch({
  title,
  description,
  value,
  disabled = false,
  onValueChange,
  colors,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  colors: { titleColor: string; descriptionColor: string };
}) {
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.titleColor }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: colors.descriptionColor }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: "#D0D5DD", true: "#84ADFF" }}
        thumbColor={value ? "#3478F5" : "#F2F4F7"}
      />
    </View>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return <View style={[styles.divider, { backgroundColor: isDark ? "#3A3A3A" : "#EAECF0" }]} />;
}

function LinkRow({
  title,
  onPress,
  color,
}: {
  title: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable style={styles.linkRow} onPress={onPress}>
      <Text style={[styles.rowTitle, { color }]}>{title}</Text>
      <MaterialIcons name="chevron-right" size={22} color="#98A2B3" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 12,
    letterSpacing: 0.7,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 10,
  },
  card: { borderRadius: 14, marginBottom: 18, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", gap: 14, padding: 16 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: "Figtree-SemiBold", fontSize: 16 },
  rowDescription: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  disabled: { opacity: 0.45 },
  divider: { height: 1, marginLeft: 16 },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 16,
  },
  deleteButton: { alignItems: "center", paddingVertical: 16 },
  deleteText: { color: "#D92D20", fontFamily: "Figtree-SemiBold", fontSize: 15 },
});
