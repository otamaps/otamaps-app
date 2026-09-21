import { AppText, Row, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { radii } from "@/constants/theme";
import {
  fetchMessageRecipients,
  fetchWilmaQueryCapabilities,
  WilmaMessageRecipient,
} from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

export default function TeachersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [recipients, setRecipients] = useState<WilmaMessageRecipient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleSupported, setScheduleSupported] = useState(false);

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
            <Row
              // Only a teacher with a published schedule has anywhere to go,
              // so the rest render flat — and without a chevron promising a
              // destination that is not there.
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

              {/* Messaging is the one action with no other way in from this
                  screen, so it stays visible rather than becoming a swipe. */}
              <Pressable
                onPress={() => openMessage(item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Lähetä viesti vastaanottajalle ${item.name}`}
                style={({ pressed }) => [
                  styles.mailButton,
                  { backgroundColor: theme.accentTint },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="mail-outline" size={19} color={theme.accent} />
              </Pressable>
            </Row>
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
  mailButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
