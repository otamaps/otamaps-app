import {
  isBLEBackgroundEnabled,
  setBLEBackgroundEnabled,
  stopBLEBackgroundService,
} from "@/lib/bleBackgroundManager";
import { requestBleTrackingPermissions } from "@/lib/blePermissions";
import {
  isLessonLiveActivityEnabled,
  setLessonLiveActivityEnabled,
} from "@/lib/lessonLiveActivity";
import { openExternalUrl } from "@/lib/openExternalUrl";
import { isLiveActivityAvailable } from "@/modules/lesson-live-activity";
import { startForegroundTracking, stopAllTracking } from "@/lib/bleTrackingRuntime";
import { supabase } from "@/lib/supabase";
import {
  clearSharedWeeklySchedules,
  syncSharedWeeklySchedule,
} from "@/lib/sharedSchedule";
import {
  getUserPreferences,
  updateConsentChoices,
} from "@/lib/userPreferences";
import { fetchSchedule } from "@/lib/wilma/graphqlClient";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { radii } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import {
  AppText,
  Row,
  StateView,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";

type Banner = { message: string; actionLabel?: string; onAction?: () => void };

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [liveActivity, setLiveActivity] = useState(false);
  // iOS 16.2+ only, and the user can revoke Live Activities for the app in
  // iOS Settings at any time — so the row is hidden rather than shown broken.
  const [liveActivitySupported] = useState(() => isLiveActivityAvailable());
  const [friendLocation, setFriendLocation] = useState(false);
  const [shareSchedule, setShareSchedule] = useState(false);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const showError = (
    message: string,
    action?: { label: string; onPress: () => void },
  ) => setBanner({ message, actionLabel: action?.label, onAction: action?.onPress });

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [
          preferences,
          backgroundEnabled,
          notification,
          debugMode,
          liveActivityEnabled,
        ] = await Promise.all([
          getUserPreferences({ forceRefresh: true }),
          isBLEBackgroundEnabled(),
          Notifications.getPermissionsAsync(),
          AsyncStorage.getItem("isDebugMode"),
          isLessonLiveActivityEnabled(),
        ]);
        if (cancelled) return;
        setFriendLocation(preferences.friend_location_enabled);
        setShareSchedule(preferences.schedule_sharing_enabled);
        setAnonymousAnalytics(preferences.anonymous_analytics_enabled);
        setBackgroundTracking(
          preferences.background_tracking_enabled && backgroundEnabled
        );
        setNotificationPermission(notification.status === "granted");
        setIsDebugMode(debugMode === "true");
        setLiveActivity(liveActivityEnabled);
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

  // Every consent toggle below is optimistic: the switch flips the instant
  // the user taps it, the Supabase write happens in the background, and only
  // a failure touches the switch again — snapping it back to the value the
  // server actually has and surfacing a banner instead of blocking on it.
  const changeFriendLocation = (enabled: boolean) => {
    const previous = friendLocation;
    setFriendLocation(enabled);
    void (async () => {
      try {
        await updateConsentChoices({ friend_location_enabled: enabled });
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
        setFriendLocation(previous);
        showError(`Asetusta ei voitu tallentaa. ${errorMessage(error)}`);
      }
    })();
  };

  const changeAnonymousAnalytics = (enabled: boolean) => {
    const previous = anonymousAnalytics;
    setAnonymousAnalytics(enabled);
    void (async () => {
      try {
        await updateConsentChoices({ anonymous_analytics_enabled: enabled });
        if (enabled) await ensureForegroundTracking();
        if (!enabled && !friendLocation) await disableAllTracking();
      } catch (error) {
        setAnonymousAnalytics(previous);
        showError(`Asetusta ei voitu tallentaa. ${errorMessage(error)}`);
      }
    })();
  };

  const changeScheduleSharing = (enabled: boolean) => {
    const previous = shareSchedule;
    setShareSchedule(enabled);
    void (async () => {
      try {
        await updateConsentChoices({ schedule_sharing_enabled: enabled });
        if (!enabled) {
          await clearSharedWeeklySchedules();
        } else {
          try {
            const schedule = await fetchSchedule(undefined, { forceRefresh: true });
            await syncSharedWeeklySchedule(schedule.schedule);
          } catch (syncError) {
            // The consent itself saved fine — only this week's schedule sync
            // failed, so the switch stays on rather than being reverted.
            showError(
              "Jakaminen on päällä, mutta tämän viikon lukujärjestystä ei saatu vielä ladattua. Avaa Wilma-välilehti ja yritä uudelleen."
            );
            console.warn("Shared schedule initial sync failed", syncError);
          }
        }
      } catch (error) {
        setShareSchedule(previous);
        showError(`Asetusta ei voitu tallentaa. ${errorMessage(error)}`);
      }
    })();
  };

  const disableAllTracking = async () => {
    await updateConsentChoices({ background_tracking_enabled: false });
    setBackgroundTracking(false);
    await stopBLEBackgroundService();
    await stopAllTracking(true);
  };

  const changeBackgroundTracking = (enabled: boolean) => {
    if (!friendLocation && !anonymousAnalytics) return;
    const previous = backgroundTracking;
    setBackgroundTracking(enabled);
    void (async () => {
      try {
        if (!enabled) {
          await setBLEBackgroundEnabled(false);
          await updateConsentChoices({ background_tracking_enabled: false });
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
      } catch (error) {
        setBackgroundTracking(previous);
        await updateConsentChoices({ background_tracking_enabled: false }).catch(
          () => undefined
        );
        showError(
          `Taustapaikannusta ei voitu ottaa käyttöön. ${errorMessage(error)}`,
          { label: "Avaa asetukset", onPress: () => Linking.openSettings() }
        );
      }
    })();
  };

  const changeNotifications = async (enabled: boolean) => {
    if (!enabled) {
      await Linking.openSettings();
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    setNotificationPermission(result.status === "granted");
  };

  const changeLiveActivity = async (enabled: boolean) => {
    setLiveActivity(enabled);
    // Turning it on cannot start the card from here — ActivityKit only starts
    // an activity from the foreground with the day's lessons in hand, which
    // the Wilma tab does on its next load.
    await setLessonLiveActivityEnabled(enabled);
  };

  const changeDebugMode = async (enabled: boolean) => {
    setIsDebugMode(enabled);
    await AsyncStorage.setItem("isDebugMode", enabled.toString());
  };

  const header = useNativeHeader({ title: "Asetukset", background: "page" });

  // The scroll view is the screen's root and stays mounted through loading,
  // so the large title has something to attach to from the first frame.
  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {loading ? (
          <StateView loading />
        ) : (
          <>
            {banner ? (
              <ErrorBanner
                message={banner.message}
                actionLabel={banner.actionLabel}
                onAction={banner.onAction}
                onDismiss={() => setBanner(null)}
              />
            ) : null}

            <Surface title="Tietosuoja">
              <SettingSwitch
                title="Sijainti kavereille"
                description="Näytä sijaintisi vain hyväksytyille kavereillesi."
                value={friendLocation}
                onValueChange={changeFriendLocation}
              />
              <SettingSwitch
                title="Viikkolukujärjestys kavereille"
                description="Jaa tämän viikon oppitunnit vain hyväksytyille kavereillesi."
                value={shareSchedule}
                onValueChange={changeScheduleSharing}
              />
              <SettingSwitch
                title="Anonyymit ruuhka-arviot"
                description="Lähetä karkea tila- ja aikatieto ilman käyttäjätunnusta, luokkaa tai tarkkoja koordinaatteja."
                value={anonymousAnalytics}
                onValueChange={changeAnonymousAnalytics}
              />
              {Platform.OS === "android" || Platform.OS === "ios" ? (
                <SettingSwitch
                  title="Taustapaikannus"
                  description="Tunnista koulun majakoita myös silloin, kun OtaMaps ei ole näkyvissä."
                  value={backgroundTracking}
                  disabled={!friendLocation && !anonymousAnalytics}
                  onValueChange={changeBackgroundTracking}
                />
              ) : null}
            </Surface>

            <Surface title="Sovellus">
              <SettingSwitch
                title="Ilmoitukset"
                description="Wilma-viestit, muutokset ja kaveripyynnöt."
                value={notificationPermission}
                onValueChange={(value) => void changeNotifications(value)}
              />
              {liveActivitySupported ? (
                <SettingSwitch
                  title="Tunti lukitusnäytöllä"
                  description="Näytä meneillään oleva tunti, sen päättymisaika ja seuraava tunti tai lounas. Päivittyy, kun avaat sovelluksen."
                  value={liveActivity}
                  onValueChange={(value) => void changeLiveActivity(value)}
                />
              ) : null}
              <SettingSwitch
                title="Debug-tila"
                description="Näytä kehittäjätoiminnot."
                value={isDebugMode}
                onValueChange={(value) => void changeDebugMode(value)}
              />
            </Surface>

            <Surface>
              <Row onPress={() => router.push("/welcome/(post)/permissions")}>
                <AppText variant="body" style={styles.rowLabel}>
                  Käy onboarding uudelleen
                </AppText>
              </Row>
              <Row
                onPress={() => void openExternalUrl("https://otamaps.fi/privacy")}
              >
                <AppText variant="body" style={styles.rowLabel}>
                  Tietosuoja
                </AppText>
              </Row>
              <Row
                onPress={() => void openExternalUrl("https://otamaps.fi/terms")}
              >
                <AppText variant="body" style={styles.rowLabel}>
                  Käyttöehdot
                </AppText>
              </Row>
            </Surface>

            <Surface>
              <Row
                onPress={() =>
                  void openExternalUrl("https://otamaps.fi/remove-me")
                }
                chevron={false}
              >
                <AppText variant="body" color="danger">
                  Poista tili
                </AppText>
              </Row>
            </Surface>
          </>
        )}
      </ScrollView>
    </>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen.";
}

function ErrorBanner({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.errorBanner}>
      <PlatformSymbol
        ios="exclamationmark.triangle.fill"
        android="error"
        size={18}
        tintColor="#D92D20"
        style={styles.errorIcon}
      />
      <View style={styles.errorTextContainer}>
        <AppText variant="meta" color="danger">
          {message}
        </AppText>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <AppText variant="rowTitle" color="danger" style={styles.errorAction}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Piilota">
        <PlatformSymbol ios="xmark" android="close" size={16} tintColor="#D92D20" />
      </Pressable>
    </View>
  );
}

function SettingSwitch({
  title,
  description,
  value,
  disabled = false,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Row style={disabled ? styles.disabled : undefined}>
      <View style={styles.rowText}>
        <AppText variant="rowTitle">{title}</AppText>
        <AppText variant="meta" color="textMuted" style={styles.rowDescription}>
          {description}
        </AppText>
      </View>
      {/* The off state is left to the platform, which already draws the grey
          iOS uses for it; only the "on" tint is ours. On Android a solid blue
          track made the thumb sit badly on it, so the thumb takes the accent
          and the track a tint of it — the whole switch reads blue, with the
          thumb still visible. */}
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{
          false: undefined,
          true: Platform.OS === "ios" ? theme.accent : theme.accentTint,
        }}
        thumbColor={Platform.OS === "android" && value ? theme.accent : undefined}
      />
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  rowText: { flex: 1 },
  rowLabel: { flex: 1 },
  rowDescription: { marginTop: 4 },
  disabled: { opacity: 0.45 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF3F2",
    borderColor: "#FEE4E2",
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  errorIcon: { marginTop: 2 },
  errorTextContainer: { flex: 1, gap: 6 },
  errorAction: { marginTop: 2 },
});
