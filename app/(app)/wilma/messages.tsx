import {
  fetchMessages,
  WilmaMessage,
  WilmaMessageFolder,
} from "@/lib/wilma/graphqlClient";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

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

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const msgStr = d.toISOString().split("T")[0];

  if (msgStr === todayStr) {
    return d.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (msgStr === yesterday.toISOString().split("T")[0]) return "Eilen";

  const daysDiff = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
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

// Applying status → chip label + colour
const APPLYING_LABELS: Record<string, { label: string; color: string }> = {
  present:  { label: "Osallistuu", color: "#4caf50" },
  absent:   { label: "Poissa",     color: "#f44336" },
  unknown:  { label: "Ei vastattu", color: "#ff9800" },
};

function applyingDisplay(status: string): { label: string; color: string } {
  return APPLYING_LABELS[status] ?? { label: status, color: "#888" };
}

// ── Message row ───────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  isDark,
  onPress,
}: {
  msg: WilmaMessage;
  isDark: boolean;
  onPress: () => void;
}) {
  const senderLine = msg.folder === "outbox"
    ? msg.recipients.map((recipient) => recipient.name).join(", ") || msg.recipient || "Vastaanottaja piilotettu"
    : msg.senders.map((sender) => sender.name).join(", ") || msg.sender;
  const ts = formatTimestamp(msg.timestamp);
  const full = fullTimestamp(msg.timestamp);
  const applying = msg.applying ? applyingDisplay(msg.applying.status) : null;

  return (
    <Pressable
      style={[styles.row, isDark && { backgroundColor: "#232427", borderBottomColor: "#333" }]}
      onPress={onPress}
      android_ripple={{ color: "#00000010" }}
    >
      {/* Left: icon column */}
      <View style={styles.iconCol}>
        <MaterialIcons
          name={msg.isEvent ? "event" : "mail-outline"}
          size={20}
          color={isDark ? "#555" : "#ccc"}
        />
      </View>

      {/* Centre: subject + sender + chips */}
      <View style={styles.textCol}>
        <Text
          style={[
            styles.subject,
            !msg.isUnread && styles.subjectRead,
            isDark && { color: msg.isUnread ? "#fff" : "#d0d0d0" },
          ]}
          numberOfLines={1}
        >
          {msg.subject}
        </Text>

        <Text
          style={[styles.sender, isDark && { color: "#aaa" }]}
          numberOfLines={1}
        >
          {senderLine}
        </Text>

        <Text
          style={[styles.fullTs, isDark && { color: "#666" }]}
          numberOfLines={1}
        >
          {full}
        </Text>

        {/* Chip row – only rendered if there's something to show */}
        {(msg.isEvent || applying || msg.replies > 0) && (
          <View style={styles.chipRow}>
            {msg.isEvent && (
              <View style={[styles.chip, { backgroundColor: "#51A2FF1F" }]}>
                <Text style={[styles.chipText, { color: "#4A89EE" }]}>
                  Tapahtuma
                </Text>
              </View>
            )}
            {applying && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: applying.color + "28" },
                ]}
              >
                <Text style={[styles.chipText, { color: applying.color }]}>
                  {applying.label}
                </Text>
              </View>
            )}
            {msg.replies > 0 && (
              <View
                style={[
                  styles.chip,
                  isDark
                    ? { backgroundColor: "#333" }
                    : { backgroundColor: "#f0f0f0" },
                ]}
              >
                <MaterialIcons
                  name="reply"
                  size={10}
                  color={isDark ? "#888" : "#999"}
                  style={{ marginRight: 2 }}
                />
                <Text
                  style={[
                    styles.chipText,
                    isDark ? { color: "#888" } : { color: "#999" },
                  ]}
                >
                  {msg.replies}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Right: relative timestamp */}
      <Text style={[styles.relativeTs, isDark && { color: "#666" }]}>{ts}</Text>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  const [messages, setMessages] = useState<WilmaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<WilmaMessageFolder>("INBOX");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const msgs = await fetchMessages(folder, { forceRefresh: isRefresh });
      setMessages(msgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lataus epäonnistui");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folder]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return (
    <SafeAreaView
      style={[styles.container, isDark && { backgroundColor: "#18191B" }]}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={[
          styles.header,
          isDark && { backgroundColor: "#18191B", borderBottomColor: "#333" },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={isDark ? "#51a2ff" : "#4A89EE"}
          />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && { color: "#fff" }]}> 
          Viestit
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push("/wilma/teachers" as never)} hitSlop={8}>
          <MaterialIcons
            name="edit-square"
            size={22}
            color={isDark ? "#51a2ff" : "#4A89EE"}
          />
        </Pressable>
        {messages.length > 0 && (
          <Text style={[styles.headerCount, isDark && { color: "#666" }]}>
            {messages.length}
          </Text>
        )}
      </View>

      <View style={[styles.folderTabs, isDark && { backgroundColor: "#18191B", borderBottomColor: "#333" }]}>
        {([
          ["INBOX", "Saapuneet"],
          ["OUTBOX", "Lähetetyt"],
          ["APPOINTMENTS", "Kutsut"],
        ] as const).map(([value, label]) => {
          const active = folder === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.folderTab, active && styles.folderTabActive]}
              onPress={() => setFolder(value)}
            >
              <Text
                style={[
                  styles.folderTabText,
                  isDark && { color: "#999" },
                  active && { color: isDark ? "#51a2ff" : "#4A89EE" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <MaterialIcons
            name="error-outline"
            size={48}
            color={isDark ? "#888" : "#ccc"}
          />
          <Text style={[styles.errorText, isDark && { color: "#888" }]}>
            {error}
          </Text>
          <Pressable
            style={[styles.retryBtn, isDark && { backgroundColor: "#232427" }]}
            onPress={() => load()}
          >
            <MaterialIcons
              name="refresh"
              size={16}
              color={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <Text style={[styles.retryText, isDark && { color: "#51a2ff" }]}>
              Yritä uudelleen
            </Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && messages.length === 0 && (
        <View style={styles.centered}>
          <MaterialIcons
            name="mail-outline"
            size={52}
            color={isDark ? "#444" : "#ddd"}
          />
          <Text style={[styles.emptyText, isDark && { color: "#666" }]}>
            Ei viestejä
          </Text>
        </View>
      )}

      {!loading && !error && messages.length > 0 && (
        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
          }
          renderItem={({ item }) => (
            <MessageRow
              msg={item}
              isDark={isDark}
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
          contentContainerStyle={[
            styles.listContent,
            isDark && { backgroundColor: "#18191B" },
          ]}
          style={[styles.list, isDark && { backgroundColor: "#18191B" }]}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    gap: 12,
  },
  headerTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    color: "#222",
  },
  headerCount: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#aaa",
  },
  folderTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e4e7ec",
    paddingHorizontal: 12,
  },
  folderTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  folderTabActive: { borderBottomColor: "#4A89EE" },
  folderTabText: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    color: "#667085",
  },

  list: { flex: 1, backgroundColor: "#fff" },
  listContent: { backgroundColor: "#fff" },

  // Message row
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    gap: 10,
  },
  iconCol: {
    paddingTop: 2,
    width: 24,
    alignItems: "center",
  },
  textCol: { flex: 1 },
  subject: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  subjectRead: { fontFamily: "Figtree-Medium" },
  sender: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  fullTs: {
    fontFamily: "Figtree-Regular",
    fontSize: 11,
    color: "#bbb",
    marginTop: 2,
  },
  relativeTs: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#aaa",
    paddingTop: 2,
    minWidth: 36,
    textAlign: "right",
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: "Figtree-Medium",
    fontSize: 11,
  },

  // Error / empty
  errorText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 4,
  },
  retryText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 14,
    color: "#4A89EE",
  },
  emptyText: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#bbb",
    textAlign: "center",
  },
});
