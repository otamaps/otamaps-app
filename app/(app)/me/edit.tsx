import {
  AppText,
  Row,
  Surface,
  useNativeHeader,
  useTheme,
} from "@/components/ui";
import HueSlider, { hueToHex } from "@/components/ui/HueSlider";
import { radii } from "@/constants/theme";
import { typography } from "@/constants/typography";
import { getReadableLabelColor } from "@/lib/color";
import { generateCode } from "@/components/functions/codeGen";
import { useUser } from "@/context/UserContext";
import { formatClassLabel } from "@/lib/classLabel";
import { getUser } from "@/lib/getUserHandle";
import { supabase } from "@/lib/supabase";
import { getUserPreferences } from "@/lib/userPreferences";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

const DEFAULT_COLOR = hueToHex(0);

const Edit = () => {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [isLoading, setIsLoading] = useState(false);
  const [classError, setClassError] = useState("");
  const [isWilmaProfile, setIsWilmaProfile] = useState(false);
  const { setUser } = useUser();

  const validateClass = (text: string) => {
    // Only allow numbers and letters, max 3 characters
    const cleaned = text.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

    // If more than 3 characters, don't update
    if (cleaned.length > 3) return;

    // Update the input value
    setUserClass(cleaned);

    // Validate the format only when we have exactly 3 characters
    if (cleaned.length === 3) {
      if (/^\d{2}[A-Za-z]$/.test(cleaned)) {
        setClassError("");
      } else {
        setClassError("Syötä luokka muodossa 24A");
      }
    } else if (cleaned.length > 0) {
      // Show error if we have some input but not enough
      setClassError("Syötä 2 numeroa ja 1 kirjain");
    } else {
      setClassError("");
    }
  };

  useEffect(() => {
    // Load current user data
    const loadUserData = async () => {
      const user = await getUser();
      console.log(`👤 Authenticated user: ${user?.id || "None"} in edit.tsx`);
      if (user) {
        const [preferences, profileResult] = await Promise.all([
          getUserPreferences({ forceRefresh: true }),
          supabase
            .from("users")
            .select("name,class,color")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        setIsWilmaProfile(preferences.profile_source === "wilma");
        setName(
          profileResult.data?.name || user.user_metadata?.full_name || "",
        );
        setUserClass(
          profileResult.data?.class || user.user_metadata?.class || "",
        );
        setSelectedColor(
          profileResult.data?.color ||
            user.user_metadata?.color ||
            DEFAULT_COLOR,
        );
      }
    };

    loadUserData();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Anna nimesi");
      return;
    }

    if (
      !isWilmaProfile &&
      userClass &&
      userClass.length === 3 &&
      !/^\d{2}[A-Za-z]$/.test(userClass)
    ) {
      alert("Tarkista luokan muoto (esim. 24A)");
      return;
    }

    setIsLoading(true);
    try {
      // Get current user
      const user = await getUser({ forceRefresh: true });
      console.log(`👤 Authenticated user: ${user?.id || "None"} in edit.tsx`);
      if (!user) throw new Error("Käyttäjää ei löytynyt");

      // Update user metadata in auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: isWilmaProfile
          ? { color: selectedColor }
          : {
              full_name: name.trim(),
              class: userClass.trim(),
              color: selectedColor,
              code: generateCode(user.email as string),
            },
      });

      if (updateError) throw updateError;

      // Update users table

      const { error: dbError } = await supabase
        .from("users")
        .update(
          isWilmaProfile
            ? {
                color: selectedColor,
                updated_at: new Date().toISOString(),
              }
            : {
                name: name.trim(),
                class: userClass.trim(),
                color: selectedColor,
                updated_at: new Date().toISOString(),
              },
        )
        .eq("id", user.id);

      if (dbError) throw dbError;

      setUser({
        name: name.trim(),
        class: userClass.trim(),
        color: selectedColor,
      });

      router.back();
      // router.push({
      //   pathname: "/me",
      //   params: {
      //     name: name.trim(),
      //     class: userClass.trim(),
      //     color: selectedColor,
      //   },
      // });
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Profiilin päivitys epäonnistui. Yritä uudelleen.");
    } finally {
      setIsLoading(false);
    }
  };

  const header = useNativeHeader({
    title: "Muokkaa tietoja",
    background: "page",
  });

  return (
    <>
      <Stack.Screen options={header} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Surface title="Tiedot">
          <Row>
            <AppText variant="body" style={styles.label}>
              Nimi
            </AppText>
            <TextInput
              style={[
                styles.field,
                { color: isWilmaProfile ? theme.textMuted : theme.text },
              ]}
              value={name}
              onChangeText={setName}
              editable={!isWilmaProfile}
              placeholder="Kirjoita nimesi"
              placeholderTextColor={theme.placeholder}
              textAlign="right"
            />
          </Row>
          <Row>
            <AppText variant="body" style={styles.label}>
              Luokka
            </AppText>
            <TextInput
              style={[
                styles.field,
                {
                  color: classError
                    ? theme.danger
                    : isWilmaProfile
                      ? theme.textMuted
                      : theme.text,
                },
              ]}
              // Shown capitalised, but `userClass` itself keeps the casing it
              // was loaded with: every save submits `class`, and for a
              // Wilma-verified profile the database rejects an update that
              // changes it at all — including "24k" to "24K".
              value={isWilmaProfile ? formatClassLabel(userClass) : userClass}
              onChangeText={validateClass}
              editable={!isWilmaProfile}
              placeholder="Esimerkiksi 24Q"
              placeholderTextColor={theme.placeholder}
              maxLength={3}
              autoCapitalize="characters"
              textAlign="right"
            />
          </Row>
        </Surface>

        {isWilmaProfile ? (
          <AppText variant="meta" color="textMuted" style={styles.footnote}>
            Nimi ja luokka tulevat Wilmasta, eikä niitä voi muokata täällä.
          </AppText>
        ) : null}
        {classError ? (
          <AppText variant="meta" color="danger" style={styles.footnote}>
            {classError}
          </AppText>
        ) : null}

        <Surface title="Profiilin väri">
          <Row>
            <View style={styles.sliderWrap}>
              <HueSlider
                color={selectedColor}
                onChange={setSelectedColor}
                borderColor={theme.border}
              />
            </View>
          </Row>
        </Surface>

        <Surface title="Esikatselu">
          <Row>
            <View style={[styles.avatar, { backgroundColor: selectedColor }]}>
              <AppText
                variant="heading3"
                style={{ color: getReadableLabelColor(selectedColor) }}
              >
                {name ? name.charAt(0).toUpperCase() : "?"}
              </AppText>
            </View>
            <View style={styles.identity}>
              <AppText variant="title">{name || "Nimi"}</AppText>
              <AppText variant="meta" color="textMuted">
                {userClass ? formatClassLabel(userClass) : "Luokka"}
              </AppText>
            </View>
          </Row>
        </Surface>

        <Surface>
          <Row onPress={isLoading ? undefined : handleSave} chevron={false}>
            <AppText
              variant="body"
              color="accent"
              style={[styles.save, isLoading && styles.saving]}
            >
              {isLoading ? "Tallennetaan..." : "Tallenna muutokset"}
            </AppText>
          </Row>
        </Surface>
      </ScrollView>
    </>
  );
};

export default Edit;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 40 },
  label: { flex: 1 },
  // The value sits at the row's right edge, as it does in a Settings field.
  field: { flex: 1.4, ...typography.body, paddingVertical: 0 },
  footnote: { marginHorizontal: 20, marginTop: 6 },
  sliderWrap: { flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flex: 1 },
  save: { textAlign: "center", flex: 1 },
  saving: { opacity: 0.5 },
});
