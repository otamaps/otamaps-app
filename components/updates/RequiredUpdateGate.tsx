import { reportHandledError } from "@/lib/sentry";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

export default function RequiredUpdateGate() {
  const isDark = useColorScheme() === "dark";
  const releaseVersion = Constants.expoConfig?.version;
  const checkingRef = useRef(false);
  const updateReadyRef = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [reloading, setReloading] = useState(false);

  const checkForRequiredUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || checkingRef.current || updateReadyRef.current) {
      return;
    }

    checkingRef.current = true;
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable && !check.isRollBackToEmbedded) return;

      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched.isNew && !fetched.isRollBackToEmbedded) return;

      updateReadyRef.current = true;
      setUpdateReady(true);
    } catch (error) {
      reportHandledError(error, {
        area: "eas_update",
        operation: "check_and_download_required_update",
        level: "warning",
      });
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void checkForRequiredUpdate();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkForRequiredUpdate();
    });
    return () => subscription.remove();
  }, [checkForRequiredUpdate]);

  const applyUpdate = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch (error) {
      setReloading(false);
      reportHandledError(error, {
        area: "eas_update",
        operation: "reload_required_update",
      });
    }
  };

  return (
    <Modal
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={updateReady}
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="system-update" size={30} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, isDark && styles.textLight]}>
            Päivitys tarvitaan
          </Text>
          <Text style={[styles.description, isDark && styles.textMutedDark]}>
            {releaseVersion ? `Versio ${releaseVersion}` : "Uusi versio"} on ladattu ja
            valmis. Päivitä sovellus jatkaaksesi.
          </Text>
          {reloading ? (
            <View style={[styles.progressCard, isDark && styles.progressCardDark]}>
              <View style={styles.progressHeader}>
                <MaterialIcons name="sync" size={21} color="#3478F5" />
                <View style={styles.progressCopy}>
                  <Text style={[styles.progressTitle, isDark && styles.textLight]}>
                    Otetaan päivitys käyttöön
                  </Text>
                  <Text style={[styles.progressDescription, isDark && styles.textMutedDark]}>
                    OtaMaps käynnistyy hetken kuluttua automaattisesti uudelleen.
                  </Text>
                </View>
              </View>
              <View style={[styles.progressTrack, isDark && styles.progressTrackDark]}>
                <View style={styles.progressFill} />
              </View>
            </View>
          ) : (
            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <MaterialIcons name="people-alt" size={19} color="#3478F5" />
                <Text style={[styles.featureText, isDark && styles.textMutedDark]}>
                  Nopeampi kaveri- ja sijaintitietojen päivitys
                </Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialIcons name="restaurant" size={19} color="#3478F5" />
                <Text style={[styles.featureText, isDark && styles.textMutedDark]}>
                  Sujuvampi kartta ja pienempi tiedonsiirto
                </Text>
              </View>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Päivitä OtaMaps nyt"
            disabled={reloading}
            onPress={() => void applyUpdate()}
            style={({ pressed }) => [
              styles.updateButton,
              pressed && styles.updateButtonPressed,
              reloading && styles.updateButtonDisabled,
            ]}
          >
            {reloading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.updateButtonText}>Käynnistetään uudelleen…</Text>
              </>
            ) : (
              <>
                <Text style={styles.updateButtonText}>Päivitä nyt</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8, 15, 28, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    maxWidth: 420,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    width: "100%",
  },
  cardDark: { backgroundColor: "#252525" },
  iconCircle: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 18,
    width: 56,
  },
  title: {
    color: "#101828",
    fontFamily: "Figtree-SemiBold",
    fontSize: 23,
    textAlign: "center",
  },
  textLight: { color: "#FFFFFF" },
  description: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  textMutedDark: { color: "#B3B3B3" },
  featureList: {
    alignSelf: "stretch",
    gap: 11,
    marginTop: 20,
  },
  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  featureText: {
    color: "#475467",
    flex: 1,
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    lineHeight: 19,
  },
  progressCard: {
    alignSelf: "stretch",
    backgroundColor: "#F3F7FE",
    borderRadius: 16,
    marginTop: 20,
    padding: 14,
  },
  progressCardDark: { backgroundColor: "#30343A" },
  progressHeader: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  progressCopy: { flex: 1 },
  progressTitle: {
    color: "#182230",
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
  },
  progressDescription: {
    color: "#667085",
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  progressTrack: {
    backgroundColor: "#D7E3F8",
    borderRadius: 4,
    height: 7,
    marginTop: 13,
    overflow: "hidden",
  },
  progressTrackDark: { backgroundColor: "#48505A" },
  progressFill: {
    backgroundColor: "#3478F5",
    borderRadius: 4,
    height: "100%",
    width: "78%",
  },
  updateButton: {
    alignItems: "center",
    backgroundColor: "#3478F5",
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 52,
    width: "100%",
  },
  updateButtonPressed: { opacity: 0.84 },
  updateButtonDisabled: { opacity: 0.72 },
  updateButtonText: {
    color: "#FFFFFF",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
});
