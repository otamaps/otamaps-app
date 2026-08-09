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

const SAVE_STAGE_MESSAGES: Record<SaveStage, string> = {
  profile: "Profiilitietoja ei voitu tallentaa. Yritä hetken kuluttua uudelleen.",
  preferences:
    "Tietosuoja-asetuksia ei voitu tallentaa. Yritä hetken kuluttua uudelleen.",
};

export default function PermissionsScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isWilmaProfile, setIsWilmaProfile] = useState(false);
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [color, setColor] = useState("#2b7fff");
  const [friendLocation, setFriendLocation] = useState(false);
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
          <Text style={styles.title}>Tarkista profiilisi</Text>
          <Text style={styles.description}>
            {isWilmaProfile
              ? "Nimi ja luokka tulevat Wilmasta eikä niitä voi muuttaa OtaMapsissa."
              : "Voit muuttaa nimeä ja luokkaa myöhemmin profiiliasetuksista."}
          </Text>
          <Text style={styles.label}>Nimi</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={!isWilmaProfile}
            style={[styles.input, isWilmaProfile && styles.lockedInput]}
          />
          <Text style={styles.label}>Luokka</Text>
          <TextInput
            value={userClass}
            onChangeText={(value) => setUserClass(value.toUpperCase())}
            editable={!isWilmaProfile}
            style={[styles.input, isWilmaProfile && styles.lockedInput]}
            autoCapitalize="characters"
          />
          {isWilmaProfile && (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={18} color="#067647" />
              <Text style={styles.verifiedText}>Wilman vahvistamat tiedot</Text>
            </View>
          )}
          <Text style={styles.label}>Profiilin väri</Text>
          <View style={styles.colors}>
            {COLORS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setColor(option)}
                style={[
                  styles.color,
                  { backgroundColor: option },
                  color === option && styles.selectedColor,
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
          <Text style={styles.title}>Valitse, mihin sijaintia käytetään</Text>
          <Text style={styles.description}>
            Valinnat ovat vapaaehtoisia ja voit muuttaa niitä asetuksista.
          </Text>
          <ChoiceRow
            title="Sijainti kavereille"
            description="Tallentaa sijaintisi käyttäjätiliisi ja näyttää sen vain hyväksytyille kavereillesi."
            value={friendLocation}
            onValueChange={setFriendLocation}
          />
          <ChoiceRow
            title="Anonyymit ruuhka-arviot"
            description="Lähettää vain karkean tila- ja aikatiedon esimerkiksi ruokalan jonon arviointiin. Käyttäjätunnusta, luokkaa tai tarkkaa sijaintia ei tallenneta."
            value={anonymousAnalytics}
            onValueChange={setAnonymousAnalytics}
          />
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <Ionicons name="bluetooth-outline" size={54} color="#3478F5" />
          <Text style={styles.title}>Sisäpaikannus</Text>
          <Text style={styles.description}>
            OtaMaps tunnistaa koulun Bluetooth-majakoita. Paikannusta käytetään vain valitsemiisi tarkoituksiin.
          </Text>
          {!trackingPurposeEnabled ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
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
          <Text style={styles.title}>Sallitaanko taustapaikannus?</Text>
          <Text style={styles.description}>
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
          />
        </>
      );
    }

    return (
      <>
        <Ionicons name="notifications-outline" size={54} color="#3478F5" />
        <Text style={styles.title}>Ilmoitukset</Text>
        <Text style={styles.description}>
          Saat ilmoituksia esimerkiksi Wilma-viesteistä, muutoksista ja kaveripyynnöistä. Voit jatkaa myös ilman ilmoituksia.
        </Text>
        <ChoiceRow
          title="Salli ilmoitukset"
          description="Käyttöjärjestelmä pyytää vielä vahvistuksen."
          value={notifications}
          onValueChange={setNotifications}
        />
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#3478F5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.progress}>
        {STEPS.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                index <= step && styles.progressDotActive,
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={styles.stepLabel}>
        {step + 1}/{STEPS.length} · {STEPS[step]}
      </Text>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.backButton}
          onPress={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0 || saving}
        >
          <Text style={[styles.backText, step === 0 && styles.disabledText]}>
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
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.choice, disabled && styles.choiceDisabled]}>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#D0D5DD", true: "#84ADFF" }}
        thumbColor={value ? "#3478F5" : "#F2F4F7"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  progress: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 12 },
  progressItem: { flex: 1, paddingHorizontal: 3 },
  progressDot: { height: 4, borderRadius: 2, backgroundColor: "#EAECF0" },
  progressDotActive: { backgroundColor: "#3478F5" },
  stepLabel: {
    color: "#667085",
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
    color: "#101828",
    fontFamily: "Figtree-SemiBold",
    fontSize: 27,
    marginTop: 18,
  },
  description: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
    marginTop: 8,
  },
  label: {
    color: "#344054",
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E4E7EC",
    borderRadius: 12,
    borderWidth: 1,
    color: "#101828",
    fontFamily: "Figtree-Regular",
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  lockedInput: { color: "#475467", backgroundColor: "#F2F4F7" },
  verifiedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 22,
    marginTop: -4,
  },
  verifiedText: {
    color: "#067647",
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
  selectedColor: { borderColor: "#FFFFFF", borderWidth: 3 },
  choice: {
    alignItems: "center",
    borderColor: "#E4E7EC",
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
    color: "#101828",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  choiceDescription: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  infoBox: { backgroundColor: "#F2F4F7", borderRadius: 12, padding: 16 },
  infoText: {
    color: "#475467",
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
    borderTopColor: "#EAECF0",
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
