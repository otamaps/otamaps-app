import { generateCode } from "@/components/functions/codeGen";
import {
  setBLEBackgroundEnabled,
  stopBLEBackgroundService,
} from "@/lib/bleBackgroundManager";
import { requestBleTrackingPermissions } from "@/lib/blePermissions";
import {
  startForegroundTracking,
  stopAllTracking,
} from "@/lib/bleTrackingRuntime";
import { supabase } from "@/lib/supabase";
import { clearSharedWeeklySchedules } from "@/lib/sharedSchedule";
import {
  getUserPreferences,
  saveOnboardingChoices,
  updateConsentChoices,
} from "@/lib/userPreferences";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

const COLORS = [
  "#fb2c36",
  "#ff6900",
  "#f0b100",
  "#00c950",
  "#00bba7",
  "#2b7fff",
  "#615fff",
  "#ad46ff",
  "#f6339a",
];

const STEPS = ["Profiili", "Tietosuoja", "Sisäpaikannus", "Taustakäyttö", "Ilmoitukset"];

type PermissionState = "idle" | "loading" | "granted" | "denied";

type SaveStage = "profile" | "preferences";

type OnboardingTheme = {
  background: string;
  surface: string;
  text: string;
  secondaryText: string;
  label: string;
  border: string;
  inputBackground: string;
  lockedBackground: string;
  lockedText: string;
  progressInactive: string;
  infoBackground: string;
  infoText: string;
  success: string;
  switchOffTrack: string;
  switchOnTrack: string;
  switchThumb: string;
};

const LIGHT_THEME: OnboardingTheme = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#101828",
  secondaryText: "#667085",
  label: "#344054",
  border: "#E4E7EC",
  inputBackground: "#F8FAFC",
  lockedBackground: "#F2F4F7",
  lockedText: "#475467",
  progressInactive: "#EAECF0",
  infoBackground: "#F2F4F7",
  infoText: "#475467",
  success: "#067647",
  switchOffTrack: "#667085",
  switchOnTrack: "#3478F5",
  switchThumb: "#FFFFFF",
};

const DARK_THEME: OnboardingTheme = {
  background: "#1E1E1E",
  surface: "#252525",
  text: "#FFFFFF",
  secondaryText: "#B3B3B3",
  label: "#D0D5DD",
  border: "#3A3A3A",
  inputBackground: "#252525",
  lockedBackground: "#303030",
  lockedText: "#D0D5DD",
  progressInactive: "#475467",
  infoBackground: "#303030",
  infoText: "#D0D5DD",
  success: "#6CE9A6",
  switchOffTrack: "#667085",
  switchOnTrack: "#3478F5",
  switchThumb: "#FFFFFF",
};

const SAVE_STAGE_MESSAGES: Record<SaveStage, string> = {
  profile: "Profiilitietoja ei voitu tallentaa. Yritä hetken kuluttua uudelleen.",
  preferences:
    "Tietosuoja-asetuksia ei voitu tallentaa. Yritä hetken kuluttua uudelleen.",
};

export default function PermissionsScreen() {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWilmaProfile, setIsWilmaProfile] = useState(false);
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [color, setColor] = useState("#2b7fff");
  const [friendLocation, setFriendLocation] = useState(false);
  const [shareSchedule, setShareSchedule] = useState(false);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [indoorPermission, setIndoorPermission] =
    useState<PermissionState>("idle");

  const trackingPurposeEnabled = friendLocation || anonymousAnalytics;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [preferences, sessionResult] = await Promise.all([
          getUserPreferences({ forceRefresh: true }),
          supabase.auth.getSession(),
        ]);
        const user = sessionResult.data.session?.user;
        if (!user) throw new Error("Käyttäjä ei ole kirjautunut sisään.");
        const { data, error } = await supabase
          .from("users")
          .select("name,class,color")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setIsWilmaProfile(preferences.profile_source === "wilma");
        setName(
          data?.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            ""
        );
        setUserClass(data?.class || user.user_metadata?.class || "");
        setColor(data?.color || user.user_metadata?.color || "#2b7fff");
        setFriendLocation(preferences.friend_location_enabled);
        setShareSchedule(preferences.schedule_sharing_enabled);
        setAnonymousAnalytics(preferences.anonymous_analytics_enabled);
        setBackgroundTracking(preferences.background_tracking_enabled);
      } catch (error) {
        Alert.alert(
          "Onboardingia ei voitu avata",
          error instanceof Error ? error.message : "Yritä hetken kuluttua uudelleen."
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

  const requestIndoorPermission = async () => {
    setIndoorPermission("loading");
    const permission = await requestBleTrackingPermissions(false);
    if (!permission.success) {
      setIndoorPermission("denied");
      return;
    }
    const started = await startForegroundTracking();
    setIndoorPermission(started.success ? "granted" : "denied");
  };

  const saveProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Käyttäjä ei ole kirjautunut sisään.");
    if (!name.trim()) throw new Error("Nimi puuttuu.");

    const profileUpdate = isWilmaProfile
      ? { color, updated_at: new Date().toISOString() }
      : {
          name: name.trim(),
          class: userClass.trim(),
          color,
          updated_at: new Date().toISOString(),
        };
    const { error: profileError } = await supabase
      .from("users")
      .update(profileUpdate)
      .eq("id", session.user.id);
    if (profileError) throw profileError;

    const metadata = isWilmaProfile
      ? { color }
      : {
          full_name: name.trim(),
          class: userClass.trim(),
          color,
          code: session.user.email ? generateCode(session.user.email) : undefined,
        };
    const { error: metadataError } = await supabase.auth.updateUser({
      data: metadata,
    });
    if (metadataError) throw metadataError;
  };

  const finishOnboarding = async () => {
    setSaving(true);
    let saveStage: SaveStage = "profile";
    try {
      await saveProfile();
      saveStage = "preferences";
      let saved = await saveOnboardingChoices({
        friend_location_enabled: friendLocation,
        schedule_sharing_enabled: shareSchedule,
        anonymous_analytics_enabled: anonymousAnalytics,
        background_tracking_enabled:
          trackingPurposeEnabled && backgroundTracking,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!friendLocation && session) {
        await supabase.from("locations").delete().eq("user_id", session.user.id);
      }
      if (!shareSchedule) await clearSharedWeeklySchedules();

      if (!trackingPurposeEnabled) {
        await stopBLEBackgroundService();
        await stopAllTracking(true);
      } else if (backgroundTracking) {
        const result = await setBLEBackgroundEnabled(true);
        if (!result?.success) {
          saved = await updateConsentChoices({
            background_tracking_enabled: false,
          });
          Alert.alert(
            "Taustapaikannus jäi pois päältä",
            "Voit antaa tarvittavat oikeudet myöhemmin asetuksista."
          );
        }
      } else if (indoorPermission === "granted") {
        await startForegroundTracking();
      }

      if (notifications) {
        await Notifications.requestPermissionsAsync();
      }

      if (saved.onboarding_version > 0) router.replace("/home");
    } catch (error) {
      console.error(`[onboarding] ${saveStage} save failed`, error);
      Alert.alert(
        "Tietoja ei voitu tallentaa",
        error instanceof Error && error.message
          ? error.message
          : SAVE_STAGE_MESSAGES[saveStage]
      );
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <Ionicons name="person-circle-outline" size={54} color="#3478F5" />
          <Text style={[styles.title, { color: theme.text }]}>Tarkista profiilisi</Text>
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            {isWilmaProfile
              ? "Nimi ja luokka tulevat Wilmasta eikä niitä voi muuttaa OtaMapsissa."
              : "Voit muuttaa nimeä ja luokkaa myöhemmin profiiliasetuksista."}
          </Text>
          <Text style={[styles.label, { color: theme.label }]}>Nimi</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={!isWilmaProfile}
            selectionColor="#3478F5"
            keyboardAppearance={isDark ? "dark" : "light"}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
              isWilmaProfile && {
                backgroundColor: theme.lockedBackground,
                color: theme.lockedText,
              },
            ]}
          />
          <Text style={[styles.label, { color: theme.label }]}>Luokka</Text>
          <TextInput
            value={userClass}
            onChangeText={(value) => setUserClass(value.toUpperCase())}
            editable={!isWilmaProfile}
            selectionColor="#3478F5"
            keyboardAppearance={isDark ? "dark" : "light"}
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
              isWilmaProfile && {
                backgroundColor: theme.lockedBackground,
                color: theme.lockedText,
              },
            ]}
            autoCapitalize="characters"
          />
          {isWilmaProfile && (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={[styles.verifiedText, { color: theme.success }]}>Wilman vahvistamat tiedot</Text>
            </View>
          )}
          <Text style={[styles.label, { color: theme.label }]}>Profiilin väri</Text>
          <View style={styles.colors}>
            {COLORS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setColor(option)}
                style={[
                  styles.color,
                  { backgroundColor: option },
                  color === option && [
                    styles.selectedColor,
                    { borderColor: theme.background },
                  ],
                ]}
              >
                {color === option && (
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            ))}
          </View>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <Ionicons name="shield-checkmark-outline" size={54} color="#3478F5" />
          <Text style={[styles.title, { color: theme.text }]}>Valitse, mihin sijaintia käytetään</Text>
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            Valinnat ovat vapaaehtoisia ja voit muuttaa niitä asetuksista.
          </Text>
          <ChoiceRow
            title="Sijainti kavereille"
            description="Tallentaa sijaintisi käyttäjätiliisi ja näyttää sen vain hyväksytyille kavereillesi."
            value={friendLocation}
            onValueChange={setFriendLocation}
            theme={theme}
          />
          <ChoiceRow
            title="Viikkolukujärjestys kavereille"
            description="Jaa tämän viikon oppituntien ajat, aineet ja luokat vain hyväksytyille kavereillesi. Viestejä, poissaoloja tai kokeita ei jaeta."
            value={shareSchedule}
            onValueChange={setShareSchedule}
            theme={theme}
          />
          <ChoiceRow
            title="Anonyymit ruuhka-arviot"
            description="Lähettää vain karkean tila- ja aikatiedon esimerkiksi ruokalan jonon arviointiin. Käyttäjätunnusta, luokkaa tai tarkkaa sijaintia ei tallenneta."
            value={anonymousAnalytics}
            onValueChange={setAnonymousAnalytics}
            theme={theme}
          />
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <Ionicons name="bluetooth-outline" size={54} color="#3478F5" />
          <Text style={[styles.title, { color: theme.text }]}>Sisäpaikannus</Text>
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            OtaMaps tunnistaa koulun Bluetooth-majakoita. Paikannusta käytetään vain valitsemiisi tarkoituksiin.
          </Text>
          {!trackingPurposeEnabled ? (
            <View style={[styles.infoBox, { backgroundColor: theme.infoBackground }]}>
              <Text style={[styles.infoText, { color: theme.infoText }]}>
                Et valinnut sijaintia käyttäviä ominaisuuksia, joten oikeuksia ei pyydetä.
              </Text>
            </View>
          ) : (
            <Pressable
              style={styles.permissionButton}
              onPress={() => void requestIndoorPermission()}
              disabled={indoorPermission === "loading"}
            >
              {indoorPermission === "loading" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.permissionButtonText}>
                  {indoorPermission === "granted"
                    ? "Oikeus annettu"
                    : indoorPermission === "denied"
                      ? "Yritä uudelleen"
                      : "Salli sisäpaikannus"}
                </Text>
              )}
            </Pressable>
          )}
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <Ionicons name="location-outline" size={54} color="#3478F5" />
          <Text style={[styles.title, { color: theme.text }]}>Sallitaanko taustapaikannus?</Text>
          <Text style={[styles.description, { color: theme.secondaryText }]}>
            Kun tämä on käytössä, OtaMaps voi tunnistaa läheisiä majakoita myös silloin, kun sovellus ei ole näkyvissä. Android näyttää tästä pysyvän ilmoituksen.
          </Text>
          <ChoiceRow
            title="Taustapaikannus"
            description={
              trackingPurposeEnabled
                ? "Käytä vain edellisessä vaiheessa valitsemiisi tarkoituksiin."
                : "Valitse ensin vähintään yksi sijaintia käyttävä ominaisuus."
            }
            value={trackingPurposeEnabled && backgroundTracking}
            onValueChange={setBackgroundTracking}
            disabled={!trackingPurposeEnabled}
            theme={theme}
          />
        </>
      );
    }

    return (
      <>
        <Ionicons name="notifications-outline" size={54} color="#3478F5" />
        <Text style={[styles.title, { color: theme.text }]}>Ilmoitukset</Text>
        <Text style={[styles.description, { color: theme.secondaryText }]}>
          Saat ilmoituksia esimerkiksi Wilma-viesteistä, muutoksista ja kaveripyynnöistä. Voit jatkaa myös ilman ilmoituksia.
        </Text>
        <ChoiceRow
          title="Salli ilmoitukset"
          description="Käyttöjärjestelmä pyytää vielä vahvistuksen."
          value={notifications}
          onValueChange={setNotifications}
          theme={theme}
        />
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#3478F5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.progress}>
        {STEPS.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                { backgroundColor: theme.progressInactive },
                index <= step && styles.progressDotActive,
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.stepLabel, { color: theme.secondaryText }]}>
        {step + 1}/{STEPS.length} · {STEPS[step]}
      </Text>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0 || saving}
        >
          <Text
            style={[
              styles.backText,
              { color: theme.secondaryText },
              step === 0 && styles.disabledText,
            ]}
          >
            Takaisin
          </Text>
        </Pressable>
        <Pressable
          style={[styles.nextButton, saving && styles.disabledButton]}
          onPress={() =>
            step === STEPS.length - 1
              ? void finishOnboarding()
              : setStep((value) => value + 1)
          }
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.nextText}>
              {step === STEPS.length - 1 ? "Aloita" : "Jatka"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ChoiceRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  theme,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  theme: OnboardingTheme;
}) {
  return (
    <View
      style={[
        styles.choice,
        { backgroundColor: theme.surface, borderColor: theme.border },
        disabled && styles.choiceDisabled,
      ]}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.choiceDescription, { color: theme.secondaryText }]}>
          {description}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        accessibilityHint={description}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        ios_backgroundColor={theme.switchOffTrack}
        trackColor={{
          false: theme.switchOffTrack,
          true: theme.switchOnTrack,
        }}
        thumbColor={theme.switchThumb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 12 },
  progressItem: { flex: 1, paddingHorizontal: 3 },
  progressDot: { height: 4, borderRadius: 2 },
  progressDotActive: { backgroundColor: "#3478F5" },
  stepLabel: {
    fontFamily: "Figtree-Medium",
    fontSize: 12,
    paddingHorizontal: 27,
    paddingTop: 10,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  title: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 27,
    marginTop: 18,
  },
  description: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
    marginTop: 8,
  },
  label: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  verifiedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 22,
    marginTop: -4,
  },
  verifiedText: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
  },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  color: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedColor: { borderWidth: 3 },
  choice: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
    padding: 16,
  },
  choiceDisabled: { opacity: 0.5 },
  choiceText: { flex: 1 },
  choiceTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  choiceDescription: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  infoBox: { borderRadius: 12, padding: 16 },
  infoText: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  permissionButton: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  footer: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  backText: {
    color: "#475467",
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
  },
  disabledText: { opacity: 0.3 },
  nextButton: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  nextText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  disabledButton: { opacity: 0.55 },
});
