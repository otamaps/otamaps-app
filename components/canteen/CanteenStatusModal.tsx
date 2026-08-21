import { PlatformSymbol } from "@/components/PlatformSymbol";
import {
  fetchOtaniemiMenu,
  OTANIEMI_MENU_URL,
} from "@/lib/canteenMenu";
import type { CanteenDayMenu } from "@/lib/canteenMenuCore";
import { openExternalUrl } from "@/lib/openExternalUrl";
import {
  CanteenReportError,
  formatReportingWindow,
  getCanteenReportingText,
  getQueueColor,
  getQueueLabel,
  QUEUE_LEVEL_COLORS,
  QUEUE_LEVEL_LABELS,
  QueueLevel,
  QueueStatus,
  recordCanteenQueueReport,
} from "@/lib/queueService";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  status: QueueStatus | null;
  onClose: () => void;
  onFocusMap: () => void;
  onReported: () => Promise<void>;
};

const LEVELS: QueueLevel[] = [1, 2, 3, 4, 5];

function sourceText(status: QueueStatus): string {
  if (status.status_source === "community") {
    return `${status.contributor_count} käyttäjän raportti tässä jaksossa`;
  }
  if (status.status_source === "manual") return "Henkilökunnan vahvistama arvio";
  if (status.status_source === "crowd") return "Automaattinen liikehavainto";
  if (status.report_count > 0) {
    return `Tarvitaan vähintään ${status.min_community_reports} raporttia tässä jaksossa (${status.report_count} annettu)`;
  }
  return `Tälle ${status.slot_minutes} minuutin jaksolle ei ole vielä raportteja`;
}

// The database tags every rejection with a stable marker, so the user-facing
// copy no longer depends on matching words inside the Postgres error text.
function reportErrorText(error: unknown, status: QueueStatus | null): string {
  if (error instanceof CanteenReportError) {
    switch (error.reason) {
      case "reporting_closed":
        return `Raportointi on avoinna ${formatReportingWindow(status, {
          withClock: true,
        })}.`;
      case "auth_required":
        return "Kirjaudu sisään raportoidaksesi jonotilanteen.";
      case "invalid_level":
        return "Valittu jonotaso ei kelpaa. Yritä uudelleen.";
      case "unknown_area":
        return "Ruokalinjaston raportointi ei ole juuri nyt käytössä.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Raportointi epäonnistui.";
}

export default function CanteenStatusModal({
  visible,
  status,
  onClose,
  onFocusMap,
  onReported,
}: Props) {
  const isDark = useColorScheme() === "dark";
  const [menu, setMenu] = useState<CanteenDayMenu | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const [reportingLevel, setReportingLevel] = useState<QueueLevel | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setMenuLoading(true);
    setMenuError(false);
    void fetchOtaniemiMenu()
      .then((nextMenu) => {
        if (!cancelled) setMenu(nextMenu);
      })
      .catch(() => {
        if (!cancelled) {
          setMenu(null);
          setMenuError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const submitLevel = async (level: QueueLevel) => {
    if (reportingLevel || !status?.reporting_open) return;
    setReportingLevel(level);
    try {
      await recordCanteenQueueReport(level, status);
      await onReported();
    } catch (error) {
      Alert.alert("Raporttia ei voitu tallentaa", reportErrorText(error, status));
    } finally {
      setReportingLevel(null);
    }
  };

  const statusLevel = status?.reporting_open ? status.status_level : null;

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]}>
        <View style={[styles.header, isDark && styles.borderDark]}>
          <View>
            <Text style={[styles.eyebrow, isDark && styles.textMutedDark]}>
              OTANIEMEN LUKIO
            </Text>
            <Text style={[styles.title, isDark && styles.textPrimaryDark]}>
              Ruokalinjasto
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Sulje ruokalinjaston tiedot"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <PlatformSymbol
              ios="xmark"
              android="close"
              size={22}
              tintColor={isDark ? "#F4F7FB" : "#344054"}
            />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.heroCard, isDark && styles.surfaceDark]}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIcon,
                  { backgroundColor: getQueueColor(statusLevel) },
                ]}
              >
                <MaterialIcons name="groups" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.statusText}>
                <Text style={[styles.statusLabel, isDark && styles.textMutedDark]}>
                  Tämänhetkinen vilkkaus
                </Text>
                <Text style={[styles.statusValue, isDark && styles.textPrimaryDark]}>
                  {status?.reporting_open
                    ? getQueueLabel(status.status_level)
                    : "Ei näytetä juuri nyt"}
                </Text>
              </View>
            </View>
            <Text style={[styles.supportingText, isDark && styles.textMutedDark]}>
              {status?.reporting_open
                ? sourceText(status)
                : `Vilkkaus näytetään ja sitä voi raportoida ${formatReportingWindow(
                    status,
                    { withClock: true }
                  )}.`}
            </Text>
            <Pressable
              onPress={() => {
                onFocusMap();
                onClose();
              }}
              style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="map" size={19} color="#276CE5" />
              <Text style={styles.mapButtonText}>Näytä kartalla</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>
              Raportoi jonon pituus
            </Text>
            <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
              {getCanteenReportingText(status)}
            </Text>
          </View>

          <View style={styles.levelGrid}>
            {LEVELS.map((level) => {
              const pending = reportingLevel === level;
              return (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  disabled={!status?.reporting_open || reportingLevel !== null}
                  onPress={() => void submitLevel(level)}
                  style={({ pressed }) => [
                    styles.levelButton,
                    { borderColor: QUEUE_LEVEL_COLORS[level] },
                    isDark && styles.levelButtonDark,
                    (!status?.reporting_open || reportingLevel !== null) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[styles.levelDot, { backgroundColor: QUEUE_LEVEL_COLORS[level] }]}
                  />
                  <Text style={[styles.levelText, isDark && styles.textPrimaryDark]}>
                    {QUEUE_LEVEL_LABELS[level]}
                  </Text>
                  {pending && <ActivityIndicator size="small" color={QUEUE_LEVEL_COLORS[level]} />}
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.contributionCard, isDark && styles.surfaceDark]}>
            <MaterialIcons name="volunteer-activism" size={24} color="#276CE5" />
            <View style={styles.contributionText}>
              <Text style={[styles.contributionValue, isDark && styles.textPrimaryDark]}>
                {status?.current_user_contributions ?? 0} raporttia
              </Text>
              <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
                Sinun panoksesi yhteensä. Raportit tallennetaan tilillesi, ja mitä enemmän raportoit, sitä enemmän raporttisi painaa yhteisön arviossa.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.textPrimaryDark]}>
              Päivän ruokalista
            </Text>
            <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
              Compass Group · Espoon Tietokylä / Otaniemen lukio
            </Text>
          </View>

          {menuLoading ? (
            <View style={[styles.menuState, isDark && styles.surfaceDark]}>
              <ActivityIndicator color="#276CE5" />
              <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
                Haetaan tämän päivän ruokia…
              </Text>
            </View>
          ) : menu?.sections.length ? (
            <View style={styles.menuSections}>
              {menu.sections.map((section) => (
                <View key={section.title} style={[styles.menuCard, isDark && styles.surfaceDark]}>
                  <Text style={[styles.menuTitle, isDark && styles.textPrimaryDark]}>
                    {section.title}
                  </Text>
                  {section.meals.map((meal, index) => (
                    <View key={`${meal.name}-${index}`} style={styles.mealRow}>
                      <View style={styles.mealBullet} />
                      <View style={styles.mealText}>
                        <Text style={[styles.mealName, isDark && styles.textPrimaryDark]}>
                          {meal.name}
                        </Text>
                        {!!meal.diets.length && (
                          <Text style={[styles.diets, isDark && styles.textMutedDark]}>
                            {meal.diets.join(", ")}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.menuState, isDark && styles.surfaceDark]}>
              <MaterialIcons name="restaurant-menu" size={24} color="#7D8795" />
              <Text style={[styles.sectionCaption, isDark && styles.textMutedDark]}>
                {menuError
                  ? "Ruokalistaa ei saatu ladattua juuri nyt."
                  : "Otaniemen lukion ruokalistaa ei ole julkaistu tälle päivälle."}
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => void openExternalUrl(OTANIEMI_MENU_URL)}
            style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed]}
          >
            <Text style={styles.sourceButtonText}>Avaa alkuperäinen ruokalista</Text>
            <MaterialIcons name="open-in-new" size={18} color="#276CE5" />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  safeAreaDark: { backgroundColor: "#1E2024" },
  header: { minHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#E4E8ED", paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#77818E", fontFamily: "Figtree-SemiBold", fontSize: 11, letterSpacing: 1.2 },
  title: { color: "#18202A", fontFamily: "Figtree-SemiBold", fontSize: 24, marginTop: 2 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 48 },
  heroCard: { backgroundColor: "#F4F7FC", borderRadius: 22, padding: 18 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  statusIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statusText: { flex: 1 },
  statusLabel: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 13 },
  statusValue: { color: "#18202A", fontFamily: "Figtree-SemiBold", fontSize: 22, marginTop: 2 },
  supportingText: { color: "#68717D", fontFamily: "Figtree-Regular", fontSize: 14, lineHeight: 20, marginTop: 14 },
  mapButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16, minHeight: 38 },
  mapButtonText: { color: "#276CE5", fontFamily: "Figtree-SemiBold", fontSize: 14 },
  sectionHeader: { marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 18 },
  sectionCaption: { color: "#77818E", fontFamily: "Figtree-Regular", fontSize: 13, lineHeight: 19, marginTop: 3 },
  levelGrid: { gap: 9 },
  levelButton: { minHeight: 50, borderRadius: 15, borderWidth: 1.5, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 11, backgroundColor: "#FFFFFF" },
  levelButtonDark: { backgroundColor: "#292D33" },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  levelText: { flex: 1, color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 15 },
  contributionCard: { flexDirection: "row", gap: 12, backgroundColor: "#F4F7FC", borderRadius: 18, padding: 16, marginTop: 16 },
  contributionText: { flex: 1 },
  contributionValue: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 16 },
  menuState: { minHeight: 90, backgroundColor: "#F4F7FC", borderRadius: 18, padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  menuSections: { gap: 12 },
  menuCard: { backgroundColor: "#F4F7FC", borderRadius: 18, padding: 16 },
  menuTitle: { color: "#202833", fontFamily: "Figtree-SemiBold", fontSize: 16, marginBottom: 8 },
  mealRow: { flexDirection: "row", paddingVertical: 6, gap: 10 },
  mealBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#276CE5", marginTop: 7 },
  mealText: { flex: 1 },
  mealName: { color: "#202833", fontFamily: "Figtree-Medium", fontSize: 14, lineHeight: 19 },
  diets: { color: "#77818E", fontFamily: "Figtree-Regular", fontSize: 12, marginTop: 2 },
  sourceButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 },
  sourceButtonText: { color: "#276CE5", fontFamily: "Figtree-SemiBold", fontSize: 14 },
  surfaceDark: { backgroundColor: "#292D33" },
  borderDark: { borderColor: "#3C424A" },
  textPrimaryDark: { color: "#F5F7FA" },
  textMutedDark: { color: "#ABB3BE" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
