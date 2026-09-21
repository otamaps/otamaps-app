import { AppText, Row, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { colors } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchMessageRecipients,
  fetchWilmaQueryCapabilities,
  WilmaMessageRecipient,
} from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Dismissed for good once tapped: the gesture is only unguessable the first
 * time, and a hint that comes back is worse than one that never showed.
 */
const HINT_DISMISSED_KEY = "otamaps-teachers-swipe-hint-v1";

/** The action's resting width, before a drag stretches it further. */
const ACTION_WIDTH = 84;

/**
 * How far the row must travel before the action commits on its own. iOS
 * treats roughly half the row as the point of no return, and this is measured
 * once: the value is a constant of the gesture, not of any particular row.
 */
const FULL_SWIPE = Dimensions.get("window").width * 0.5;

type SwipeableMethodsLike = { close: () => void };

/**
 * The revealed action, matched to how UIKit behaves rather than just sitting
 * there: it stretches with the drag instead of sliding in at a fixed width,
 * commits itself past `FULL_SWIPE` without waiting for a tap, and marks that
 * commit with the same impact the system uses.
 */
function MessageAction({
  translation,
  methods,
  onMessage,
  accessibilityLabel,
}: {
  translation: SharedValue<number>;
  methods: SwipeableMethodsLike;
  onMessage: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  const fire = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    methods.close();
    onMessage();
  }, [methods, onMessage]);

  // Dragging right-side actions open moves the row negative, so the distance
  // travelled is the negated translation.
  useAnimatedReaction(
    () => -translation.value,
    (travelled, previous) => {
      if (previous === null) return;
      if (travelled >= FULL_SWIPE && previous < FULL_SWIPE) runOnJS(fire)();
    },
  );

  const stretch = useAnimatedStyle(() => ({
    width: Math.max(ACTION_WIDTH, -translation.value),
  }));

  return (
    <Reanimated.View style={stretch}>
      <Pressable
        onPress={fire}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.swipeAction,
          { backgroundColor: theme.accent },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="mail-outline" size={22} color={colors.textOnDark} />
        <AppText variant="micro" style={styles.swipeLabel}>
          Viesti
        </AppText>
      </Pressable>
    </Reanimated.View>
  );
}

export default function TeachersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [recipients, setRecipients] = useState<WilmaMessageRecipient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleSupported, setScheduleSupported] = useState(false);
  // `null` until storage answers, so the hint cannot flash up and vanish for
  // someone who dismissed it long ago.
  const [hintVisible, setHintVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((dismissed) => {
        if (!cancelled) setHintVisible(dismissed !== "1");
      })
      .catch(() => {
        // Storage being unreadable is not a reason to withhold the hint.
        if (!cancelled) setHintVisible(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    void AsyncStorage.setItem(HINT_DISMISSED_KEY, "1").catch(() => {});
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      setRecipients(await fetchMessageRecipients({ forceRefresh: refresh }));
      try {
        const capabilities = await fetchWilmaQueryCapabilities({
          forceRefresh: refresh,
        });
        setScheduleSupported(capabilities.has("teacherSchedule"));
      } catch {
        setScheduleSupported(false);
      }
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Vastaanottajien lataus epäonnistui",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fi-FI");
    return recipients
      .filter(
        (item) =>
          !needle ||
          `${item.name} ${item.code} ${item.category}`
            .toLocaleLowerCase("fi-FI")
            .includes(needle),
      )
      .sort((a, b) => {
        if (a.isOwnTeacher !== b.isOwnTeacher) return a.isOwnTeacher ? -1 : 1;
        return a.name.localeCompare(b.name, "fi-FI");
      });
  }, [query, recipients]);

  const openMessage = (item: WilmaMessageRecipient) =>
    router.push({
      pathname: "/wilma/compose" as never,
      params: {
        recipientId: String(item.id),
        schoolId: String(item.schoolId),
        name: item.name,
        code: item.code,
      },
    });

  const openSchedule = (item: WilmaMessageRecipient) =>
    router.push({
      pathname: "/wilma/teacher-schedule" as never,
      params: { teacherId: String(item.id), name: item.name, code: item.code },
    });

  const header = useNativeHeader({
    title: "Opettajat ja henkilökunta",
    background: "card",
    search: {
      placeholder: "Hae nimellä tai lyhenteellä",
      onChangeText: setQuery,
    },
  });

  // The list is the screen's root element and stays mounted through every
  // state, so the large title has a scroll view to attach to from the first
  // frame. See `useNativeHeader`.
  return (
    <>
      <Stack.Screen options={header} />
      <FlatList
        data={loading || error ? [] : filtered}
        keyExtractor={(item) => `${item.id}:${item.schoolId}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={theme.accent}
          />
        }
        ListHeaderComponent={
          hintVisible ? (
            <View
              style={[
                styles.hint,
                { backgroundColor: theme.card, borderBottomColor: theme.border },
              ]}
            >
              <MaterialIcons name="swipe-left" size={18} color={theme.textMuted} />
              <AppText variant="caption" color="textMuted" style={styles.hintText}>
                Napauta avataksesi lukujärjestyksen. Pyyhkäise vasemmalle
                lähettääksesi viestin.
              </AppText>
              <Pressable
                onPress={dismissHint}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Piilota vinkki"
              >
                <MaterialIcons name="close" size={18} color={theme.textFaint} />
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <StateView loading />
          ) : error ? (
            <StateView
              icon="error-outline"
              message={error}
              actionLabel="Yritä uudelleen"
              onAction={() => void load()}
            />
          ) : (
            <StateView message="Ei hakutuloksia" />
          )
        }
        renderItem={({ item }) => {
          const isTeacher = item.category
            .toLocaleLowerCase("fi-FI")
            .includes("opettajat");
          const hasSchedule = isTeacher && scheduleSupported;

          return (
            <ReanimatedSwipeable
              // Lighter than the default so the row tracks the finger the
              // way a UIKit cell does, and free to overshoot, which is what
              // makes the stretch past the threshold feel like a commit.
              friction={1.6}
              rightThreshold={ACTION_WIDTH * 0.6}
              renderRightActions={(_progress, translation, methods) => (
                <MessageAction
                  translation={translation}
                  methods={methods}
                  onMessage={() => openMessage(item)}
                  accessibilityLabel={`Lähetä viesti vastaanottajalle ${item.name}`}
                />
              )}
            >
              <Row
                // Only a teacher with a published schedule has anywhere to go,
                // so the rest render flat — and without a chevron promising a
                // destination that is not there. Every row still swipes.
                onPress={hasSchedule ? () => openSchedule(item) : undefined}
                accessibilityLabel={
                  hasSchedule
                    ? `Näytä opettajan ${item.name} lukujärjestys`
                    : undefined
                }
              >
                <View style={styles.rowText}>
                  <View style={styles.nameLine}>
                    <AppText
                      variant="rowTitle"
                      style={styles.name}
                      numberOfLines={1}
                    >
                      {item.name}
                    </AppText>
                    {!!item.code && (
                      <AppText variant="meta" color="textMuted">
                        ({item.code})
                      </AppText>
                    )}
                  </View>
                  <AppText
                    variant="caption"
                    color="textMuted"
                    style={styles.category}
                    numberOfLines={1}
                  >
                    {item.isOwnTeacher ? "Oma opettaja · " : ""}
                    {item.category}
                  </AppText>
                </View>
              </Row>
            </ReanimatedSwipeable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Lets the loading and empty blocks fill the screen rather than collapsing
  // to nothing at the top of an empty list.
  content: { flexGrow: 1 },
  rowText: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  category: { marginTop: 2 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hintText: { flex: 1 },
  swipeAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeLabel: { color: colors.textOnDark },
  pressed: { opacity: 0.6 },
});
