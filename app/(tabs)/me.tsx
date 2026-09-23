import { PlatformSymbol } from "@/components/PlatformSymbol";
import {
  AppText,
  Row,
  Screen,
  StateView,
  Surface,
  useTheme,
} from "@/components/ui";
import { DEFAULT_USER_COLOR, colors, radii } from "@/constants/theme";
import { FABLAB_VISIBLE } from "@/constants/features";
import { formatClassLabel } from "@/lib/classLabel";
import { clearUserCache, getUser } from "@/lib/getUserHandle";
import { signOutGoogleAndSupabase } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/userPreferences";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

type UserProfile = {
  name: string;
  class?: string;
  color: string;
  email?: string;
  code?: string;
  role?: "user" | "admin";
};

const copyToClipboard = async (value: string | undefined) => {
  if (!value) return;
  const Clipboard = await import("expo-clipboard");
  await Clipboard.setStringAsync(value);
};

/** A short neutral tag at the end of a row: "Yhdistetty", "Uusi!". */
function Badge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.border }]}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

export default function MeScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isWilmaProfile, setIsWilmaProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.name || params.class || params.color) {
      setProfile((prev) => {
        if (!prev) return prev;
        const getString = (val: unknown, fallback: string): string =>
          typeof val === "string"
            ? val
            : Array.isArray(val)
              ? (val[0] ?? fallback)
              : fallback;
        return {
          ...prev,
          name: getString(params.name, prev.name),
          class: getString(params.class, prev.class ?? ""),
          color: getString(params.color, prev.color),
        };
      });
    }
  }, [params]);

  // One definition, called both on mount and on every focus. It used to be
  // written out twice, identically, in an effect and a focus effect.
  const loadProfile = useCallback(async () => {
    try {
      const user = await getUser();
      if (!user) throw new Error("No user found");

      const preferences = await getUserPreferences({ forceRefresh: true });
      setIsWilmaProfile(preferences.profile_source === "wilma");

      const fromAuth: UserProfile = {
        name:
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Käyttäjä",
        class: user.user_metadata?.class || "",
        color: user.user_metadata?.color || DEFAULT_USER_COLOR,
        email: user.email,
      };

      const { data, error } = await supabase
        .from("users")
        .select("name, class, color, code, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(data.role === "admin");
        setProfile({
          ...fromAuth,
          ...data,
          name: data.name || fromAuth.name,
          class: data.class || fromAuth.class,
          color: data.color || fromAuth.color,
        });
      } else {
        setProfile(fromAuth);
      }
    } catch (caught) {
      console.error("Error fetching profile:", caught);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();

    const channel = supabase
      .channel("profile_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users" },
        (payload) => {
          if (!payload.new) return;
          setProfile((prev) => ({
            ...prev,
            ...payload.new,
            name: payload.new.name || prev?.name,
            class: payload.new.class || prev?.class,
            color: payload.new.color || prev?.color,
          }));
          if (typeof payload.new.role === "string") {
            setIsAdmin(payload.new.role === "admin");
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.getItem("isDebugMode").then((value) =>
        setIsDebugMode(value === "true"),
      );
      void loadProfile();
    }, [loadProfile]),
  );

  const copyFriendCode = async () => {
    try {
      await copyToClipboard(profile?.code);
      Alert.alert("Kopioitu!", "Ystäväkoodi kopioitu!");
    } catch {
      Alert.alert(
        "Ei onnistunut",
        "Leikepöydän käyttö ei ole saatavilla tässä versiossa.",
      );
    }
  };

  const signOut = () => {
    signOutGoogleAndSupabase()
      .catch((caught) => console.error("Sign-out failed:", caught))
      .finally(() => {
        clearUserCache();
        router.push("/");
      });
  };

  // No navigation bar: the tab bar already names this screen, and a large
  // title would only say "Minä" a second time. `Screen` supplies the shell
  // the bar would otherwise have provided — the safe-area inset and the page
  // colour the groups sit on.
  return (
    <Screen background="page">
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <StateView loading />
        ) : (
          <>
            <Surface>
              <Row onPress={() => router.push("/me/edit")}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: profile?.color || DEFAULT_USER_COLOR },
                  ]}
                >
                  <AppText variant="title" style={styles.avatarLetter}>
                    {profile?.name?.charAt(0).toUpperCase() ?? "?"}
                  </AppText>
                </View>
                <View style={styles.identity}>
                  <AppText variant="sectionTitle" numberOfLines={1}>
                    {profile?.name || "Käyttäjä"}
                  </AppText>
                  {profile?.class ? (
                    <AppText variant="meta" color="textMuted" numberOfLines={1}>
                      {formatClassLabel(profile.class)}
                    </AppText>
                  ) : null}
                </View>
              </Row>

              <Row onPress={copyFriendCode}>
                <AppText variant="rowTitle" style={styles.rowLabel}>
                  Ystäväkoodi
                </AppText>
                <AppText variant="rowTitle" color="textMuted">
                  {profile?.code ?? "—"}
                </AppText>
                <PlatformSymbol
                  ios="doc.on.doc"
                  android="content_copy"
                  size={16}
                  tintColor={theme.textFaint}
                />
              </Row>
            </Surface>

            {isAdmin ? (
              <Surface title="Hallinta">
                <Row onPress={() => router.push("/me/admin/queue")}>
                  <AppText variant="rowTitle" style={styles.rowLabel}>
                    Jonotilanteen hallinta
                  </AppText>
                  <PlatformSymbol
                    ios="checkmark.shield"
                    android="admin_panel_settings"
                    size={20}
                    tintColor={theme.accent}
                  />
                </Row>
                <Row onPress={() => router.push("/me/admin/lunch-shifts")}>
                  <AppText variant="rowTitle" style={styles.rowLabel}>
                    Ruokailuvuorojen hallinta
                  </AppText>
                  <PlatformSymbol
                    ios="fork.knife"
                    android="restaurant"
                    size={20}
                    tintColor={theme.accent}
                  />
                </Row>
              </Surface>
            ) : null}

            <Surface>
              <Row onPress={() => router.push("/me/wilma")}>
                <AppText variant="rowTitle" style={styles.rowLabel}>
                  {isWilmaProfile ? "Wilma-tili" : "Yhdistä Wilma-tili"}
                </AppText>
                <Badge label={isWilmaProfile ? "Yhdistetty" : "Yhdistä"} />
              </Row>
              {FABLAB_VISIBLE ? (
                <Row onPress={() => router.push("/me/fablab")}>
                  <AppText variant="rowTitle" style={styles.rowLabel}>
                    Fablab
                  </AppText>
                  <Badge label="Uusi!" />
                </Row>
              ) : null}
              <Row onPress={() => router.push("/me/settings")}>
                <AppText variant="rowTitle" style={styles.rowLabel}>
                    Asetukset
                  </AppText>
              </Row>
              <Row onPress={() => router.push("/me/guide")}>
                <AppText variant="rowTitle" style={styles.rowLabel}>
                    Ohje
                  </AppText>
              </Row>
              <Row onPress={() => router.push("/me/about")}>
                <AppText variant="rowTitle" style={styles.rowLabel}>
                    Tietoja
                  </AppText>
              </Row>
            </Surface>

            {isDebugMode ? (
              <Surface>
                <Row onPress={() => router.push("/(app)/debug2/ble")}>
                  <AppText variant="rowTitle" style={styles.rowLabel}>
                    Debug
                  </AppText>
                </Row>
              </Surface>
            ) : null}

            <Surface title="Vaara-alue" titleColor="danger">
              <Row onPress={signOut} chevron={false}>
                <AppText variant="rowTitle" color="danger">
                  Kirjaudu ulos
                </AppText>
              </Row>
            </Surface>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  // Always white: it sits on the user's own colour, not on a themed surface.
  avatarLetter: { color: colors.textOnDark },
  identity: { flex: 1 },
  rowLabel: { flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
});
