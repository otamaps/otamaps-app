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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  runOnJS,
  useAnimatedReaction,
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

type SwipeableRef = React.ComponentRef<typeof ReanimatedSwipeable>;

/**
 * The revealed action.
 *
 * Its width is fixed and never animated: driving `width` from the drag makes
 * the whole row re-layout on every frame, which is what made this stutter.
 * The background instead reaches far past the right edge, so pulling beyond
 * the action's resting width still shows colour rather than a gap, and the
 * only thing that moves is the row itself — a transform the UI thread
 * handles alone.
 */
function MessageAction({
  translation,
  methods,
  onMessage,
  accessibilityLabel,
}: {
  translation: SharedValue<number>;
  methods: { close: () => void };
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
  // travelled is the negated translation. Runs on the UI thread; only the
  // single crossing hops to JS.
  useAnimatedReaction(
    () => -translation.value,
    (travelled, previous) => {
      if (previous === null) return;
      if (travelled >= FULL_SWIPE && previous < FULL_SWIPE) runOnJS(fire)();
    },
  );

  return (
    <View style={styles.actionSlot}>
      <View style={[styles.actionBleed, { backgroundColor: theme.accent }]} />
      <Pressable
        onPress={fire}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.swipeAction, pressed && styles.pressed]}
      >
        <MaterialIcons name="mail-outline" size={22} color={colors.textOnDark} />
        <AppText variant="micro" style={styles.swipeLabel}>
          Viesti
        </AppText>
      </Pressable>
    </View>
  );
}

/**
 * Memoised: without it every keystroke in the search field re-renders each
 * visible row, and a row carries a gesture handler.
 */
const TeacherRow = memo(function TeacherRow({
  item,
  hasSchedule,
  openRowRef,
  onMessage,
  onSchedule,
}: {
  item: WilmaMessageRecipient;
  hasSchedule: boolean;
  openRowRef: React.MutableRefObject<SwipeableRef | null>;
  onMessage: (item: WilmaMessageRecipient) => void;
  onSchedule: (item: WilmaMessageRecipient) => void;
}) {
  const swipeRef = useRef<SwipeableRef | null>(null);

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      // Lighter than the default so the row tracks the finger the way a UIKit
      // cell does, and free to overshoot, which is what makes pulling past
      // the threshold feel like a commit.
      friction={1.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      onSwipeableWillOpen={() => {
        // One row open at a time, as in Mail: opening this closes whichever
        // was left open.
        const previous = openRowRef.current;
        if (previous && previous !== swipeRef.current) previous.close();
        openRowRef.current = swipeRef.current;
      }}
      onSwipeableWillClose={() => {
        if (openRowRef.current === swipeRef.current) openRowRef.current = null;
      }}
      renderRightActions={(_progress, translation, methods) => (
        <MessageAction
          translation={translation}
          methods={methods}
          onMessage={() => onMessage(item)}
          accessibilityLabel={`Lähetä viesti vastaanottajalle ${item.name}`}
        />
      )}
    >
      <Row
        // Only a teacher with a published schedule has anywhere to go, so the
        // rest render flat — and without a chevron promising a destination
        // that is not there. Every row still swipes.
        onPress={hasSchedule ? () => onSchedule(item) : undefined}
        accessibilityLabel={
          hasSchedule
            ? `Näytä opettajan ${item.name} lukujärjestys`
            : undefined
        }
      >
        <View style={styles.rowText}>
          <View style={styles.nameLine}>
            <AppText variant="rowTitle" style={styles.name} numberOfLines={1}>
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
});

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

  const openRowRef = useRef<SwipeableRef | null>(null);

  const openMessage = useCallback(
    (item: WilmaMessageRecipient) =>
      router.push({
      pathname: "/wilma/compose" as never,
      params: {
        recipientId: String(item.id),
        schoolId: String(item.schoolId),
        name: item.name,
          code: item.code,
        },
      }),
    [router],
  );

  const openSchedule = useCallback(
    (item: WilmaMessageRecipient) =>
      router.push({
        pathname: "/wilma/teacher-schedule" as never,
        params: { teacherId: String(item.id), name: item.name, code: item.code },
      }),
    [router],
  );

  const header = useNativeHeader({
    title: "Opettajat ja henkilökunta",
    background: "card",
    searchPlaceholder: "Hae nimellä tai lyhenteellä",
    onSearch: setQuery,
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
        // Every mounted row carries a pan detector, a tap detector and the
        // worklet behind the full swipe — gesture-handler builds the action
        // eagerly for each row, not when one is swiped. At the default
        // windowSize of 21 that is ten screens of them either side, and
        // tearing the lot down is what froze the screen on the way back.
        // Two screens either side is plenty to scroll against.
        windowSize={5}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
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
          return (
            <TeacherRow
              item={item}
              hasSchedule={isTeacher && scheduleSupported}
              openRowRef={openRowRef}
              onMessage={openMessage}
              onSchedule={openSchedule}
            />
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
  actionSlot: { width: ACTION_WIDTH },
  // Reaches past the right edge so an overshooting drag still lands on
  // colour. Cheaper than widening the action as the row moves.
  actionBleed: { position: "absolute", top: 0, bottom: 0, left: 0, right: -600 },
  swipeAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeLabel: { color: colors.textOnDark },
  pressed: { opacity: 0.6 },
});
