import { AppText, Row, StateView, useNativeHeader, useTheme } from "@/components/ui";
import { fetchWilmaRooms, WilmaRoomProfile } from "@/lib/wilma/graphqlClient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

export default function WilmaRoomsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [rooms, setRooms] = useState<WilmaRoomProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      setRooms(await fetchWilmaRooms({ forceRefresh: refresh }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tilojen lataaminen epäonnistui.",
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
    if (!needle) return rooms;
    return rooms.filter((room) =>
      `${room.code} ${room.name}`.toLocaleLowerCase("fi-FI").includes(needle),
    );
  }, [query, rooms]);

  const header = useNativeHeader({
    title: "Tilojen lukujärjestykset",
    background: "card",
    searchPlaceholder: "Hae tilan numerolla tai nimellä",
    onSearch: setQuery,
  });

  // The list is the screen's root element, and stays mounted through every
  // state: UIKit attaches the large title to the scroll view directly under
  // the screen, so both a wrapper view and a plain View rendered while
  // loading leave it with nothing to track.
  return (
    <>
      <Stack.Screen options={header} />
      <FlatList
        data={loading || error ? [] : filtered}
        keyExtractor={(item) => String(item.id)}
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
            <StateView message="Tiloja ei löytynyt." />
          )
        }
        renderItem={({ item }) => (
          <Row
            accessibilityLabel={`Näytä tilan ${item.code} lukujärjestys`}
            onPress={() =>
              router.push({
                pathname: "/wilma/room-schedule" as never,
                params: {
                  roomId: String(item.id),
                  code: item.code,
                  name: item.name,
                },
              })
            }
          >
            <View style={styles.rowText}>
              <AppText variant="rowTitle" numberOfLines={1}>
                {item.code}
              </AppText>
              <AppText
                variant="caption"
                color="textMuted"
                style={styles.category}
                numberOfLines={1}
              >
                {item.name || "Ei kuvausta"}
              </AppText>
            </View>
          </Row>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Lets the loading and empty blocks fill the screen rather than collapsing
  // to nothing at the top of an empty list.
  content: { flexGrow: 1 },
  rowText: { flex: 1 },
  category: { marginTop: 2 },
});
