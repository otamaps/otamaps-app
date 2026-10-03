import {
  AppText,
  Row,
  SegmentedControl,
  StateView,
  useNativeHeader,
  useTheme,
  type Theme,
} from "@/components/ui";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import {
  fetchMessages,
  WilmaMessage,
  WilmaMessageFolder,
} from "@/lib/wilma/graphqlClient";
import { formatLocalISO } from "@/lib/wilma/scheduleDates";
import { scopeBarIn, SearchScopeBar } from "@/modules/search-scope-bar";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

const FOLDERS = [
  ["INBOX", "Saapuneet"],
  ["OUTBOX", "Lähetetyt"],
  ["APPOINTMENTS", "Kutsut"],
] as const;

/**
 * Relative timestamp label:
 *   – today      → "16:15"
 *   – yesterday  → "Eilen"
 *   – this week  → "Ma" (weekday abbreviation)
 *   – older      → "21.5."
 */
function formatTimestamp(ts: string): string {
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;

  // Local calendar dates, not `toISOString()`: in UTC a Finnish evening is
  // still the previous day, so a message sent at 23:30 and read at 00:30 fell
  // on the same UTC day and was labelled with a time instead of "Eilen".
  const now = new Date();
  const todayStr = formatLocalISO(now);
  const msgStr = formatLocalISO(d);

  if (msgStr === todayStr) {
    return d.toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (msgStr === formatLocalISO(yesterday)) return "Eilen";

  const daysDiff = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDiff < 7) return WEEKDAY_SHORT[d.getDay()];

  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** Full date+time for the detail subtitle ("21.5.2026 klo 16:15"). */
function fullTimestamp(ts: string): string {
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  const date = d.toLocaleDateString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} klo ${time}`;
}

// Applying status → chip label. Colour comes from the theme: present reads
// as an ordinary quiet chip, the other two lean on the app's one accent and
// its danger red rather than inventing an amber/green scale for one field.
const APPLYING_LABELS: Record<string, string> = {
  present: "Osallistuu",
  absent: "Poissa",
  unknown: "Ei vastattu",
};

function applyingLabel(status: string): string {
  return APPLYING_LABELS[status] ?? status;
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  theme,
  onPress,
}: {
  msg: WilmaMessage;
  theme: Theme;
  onPress: () => void;
}) {
  const senderLine =
    msg.folder === "outbox"
      ? msg.recipients.map((recipient) => recipient.name).join(", ") ||
        msg.recipient ||
        "Vastaanottaja piilotettu"
      : msg.senders.map((sender) => sender.name).join(", ") || msg.sender;
  const ts = formatTimestamp(msg.timestamp);
  const full = fullTimestamp(msg.timestamp);
  const applyingColor =
    msg.applying?.status === "absent" ? theme.danger : theme.accent;

  return (
    <Row style={styles.row} onPress={onPress} chevron={false}>
      <PlatformSymbol
        ios={msg.isEvent ? "calendar" : "envelope"}
        android={msg.isEvent ? "event" : "mail"}
        size={18}
        tintColor={theme.textFaint}
        style={styles.icon}
      />

      <View style={styles.text}>
        <AppText
          variant="rowTitle"
          color={msg.isUnread ? "text" : "textSecondary"}
          numberOfLines={1}
        >
          {msg.subject}
        </AppText>
        <AppText
          variant="meta"
          color="textMuted"
          style={styles.sender}
          numberOfLines={1}
        >
          {senderLine}
        </AppText>
        <AppText
          variant="caption"
          color="textFaint"
          style={styles.fullTs}
          numberOfLines={1}
        >
          {full}
        </AppText>

        {msg.isEvent || msg.applying || msg.replies > 0 ? (
          <View style={styles.chipRow}>
            {msg.isEvent && (
              <View
                style={[styles.chip, { backgroundColor: theme.accentTint }]}
              >
                <AppText variant="micro" color="accent">
                  Tapahtuma
                </AppText>
              </View>
            )}
            {msg.applying && (
              <View
                style={[styles.chip, { backgroundColor: theme.accentTint }]}
              >
                <AppText variant="micro" style={{ color: applyingColor }}>
                  {applyingLabel(msg.applying.status)}
                </AppText>
              </View>
            )}
            {msg.replies > 0 && (
              <View style={[styles.chip, { backgroundColor: theme.border }]}>
                <PlatformSymbol
                  ios="arrowshape.turn.up.left"
                  android="reply"
                  size={10}
                  tintColor={theme.textMuted}
                  style={styles.replyIcon}
                />
                <AppText variant="micro" color="textMuted">
                  {msg.replies}
                </AppText>
              </View>
            )}
          </View>
        ) : null}
      </View>

      <AppText variant="caption" color="textFaint" style={styles.relativeTs}>
        {ts}
      </AppText>
    </Row>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [messages, setMessages] = useState<WilmaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<WilmaMessageFolder>("INBOX");

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        setMessages(await fetchMessages(folder, { forceRefresh: isRefresh }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Lataus epäonnistui");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [folder],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fi-FI");
    if (!needle) return messages;
    return messages.filter((msg) =>
      [msg.subject, msg.sender, ...msg.senders.map((s) => s.name)].some(
        (field) => field?.toLocaleLowerCase("fi-FI").includes(needle),
      ),
    );
  }, [messages, query]);

  // A large title with the list as the screen's root, the search field under
  // it, and the folders in the bar as its scope bar — as the teachers page.
  const header = useNativeHeader({
    title: "Viestit",
    background: "card",
    searchPlaceholder: "Hae aiheella tai lähettäjällä",
    onSearch: setQuery,
    action: {
      icon: "square.and.pencil",
      androidIcon: "edit",
      accessibilityLabel: "Uusi viesti",
      onPress: () => router.push("/wilma/teachers" as never),
    },
  });

  const scopeInBar = scopeBarIn(header);

  return (
    <>
      <Stack.Screen options={header} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          scopeInBar ? null : (
            <SegmentedControl
              value={folder}
              onChange={setFolder}
              options={FOLDERS}
            />
          )
        }
        data={loading || error ? [] : shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
            <StateView
              icon={query.trim() ? "search-off" : "mail-outline"}
              message={
                query.trim()
                  ? `Ei tuloksia haulle ”${query.trim()}”.`
                  : "Ei viestejä"
              }
            />
          )
        }
        renderItem={({ item }) => (
          <MessageRow
            msg={item}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: "/wilma/message",
                params: {
                  id: String(item.id),
                  subject: item.subject,
                  sender: item.senders[0]?.name ?? item.sender,
                },
              })
            }
          />
        )}
      />
      {/* After the list, not before: UIKit attaches the large title, search
          field and scroll-edge effect to the first scroll view in the
          screen, and this view draws nothing but would be first. */}
      {scopeInBar ? (
        <SearchScopeBar value={folder} onChange={setFolder} options={FOLDERS} />
      ) : null}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  row: { alignItems: "flex-start" },
  icon: { marginTop: 2 },
  text: { flex: 1 },
  sender: { marginTop: 2 },
  fullTs: { marginTop: 2 },
  relativeTs: { paddingTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  replyIcon: { marginRight: 2 },
});
