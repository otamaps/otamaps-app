import { PlatformSymbol } from "@/components/PlatformSymbol";
import {
  AttendanceEntry,
  clearSession,
  Exam,
  fetchAttendance,
  fetchMe,
  fetchMessages,
  fetchSchedule,
  getCredentials,
  getSession,
  loginMutation,
  LoginResult,
  reauthenticate,
  ScheduleLesson,
  WilmaMessage,
  WilmaStudentProfile,
} from "@/lib/wilma/graphqlClient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function isoWeekday(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function todayFinnish(): string {
  return new Date().toLocaleDateString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

// Dates from the API arrive either as ISO "YYYY-MM-DD" (dateArray) or
// Finnish "D.M.YYYY" (exam.date, attendance.date).
function formatDateFI(d: string): string {
  if (d.includes("-")) {
    const [y, m, day] = d.split("-");
    return `${parseInt(day)}.${parseInt(m)}.${y}`;
  }
  return d;
}

function finnishToISO(d: string): string {
  const [day, month, year] = d.split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const ATTENDANCE_COLORS: Record<number, { bg: string; label: string }> = {
  10: { bg: "#ff6b6b", label: "Poissaolo" },
  16: { bg: "#a0522d", label: "Terveys" },
  31: { bg: "#4caf50", label: "Koulutoiminta" },
  32: { bg: "#ff9800", label: "Muu lupa" },
};

function isNetworkError(msg: string) {
  return (
    msg.includes("aikakatkaistiin") ||
    msg.includes("Network request failed") ||
    msg.includes("fetch") ||
    msg.includes("network")
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionCard({
  title,
  badge,
  onMore,
  children,
  isDark,
}: {
  title: string;
  badge?: number;
  onMore?: () => void;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <View style={[styles.card, isDark && { backgroundColor: "#303030" }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, isDark && { color: "#fff" }]}>{title}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {onMore && (
          <Pressable onPress={onMore} hitSlop={8}>
            <Text style={[styles.moreLink, isDark && { color: "#51a2ff" }]}>
              Kaikki →
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function EmptyRow({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <Text style={[styles.emptyText, isDark && { color: "#666" }]}>{label}</Text>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.divider, isDark && { backgroundColor: "#454545" }]} />
  );
}

// ── Login screen ───────────────────────────────────────────────────────────────

function LoginView({
  isDark,
  onLogin,
}: {
  isDark: boolean;
  onLogin: (result: LoginResult) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill from SecureStore if credentials were previously saved
  useEffect(() => {
    getCredentials().then((creds) => {
      if (creds) {
        setUsername(creds.username);
        setPassword(creds.password);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Täytä kaikki kentät");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await loginMutation(username.trim(), password);
      onLogin(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kirjautuminen epäonnistui";
      if (isNetworkError(msg)) {
        setError("Ei yhteyttä palvelimeen. Tarkista, että GraphQL-palvelin on käynnissä.");
      } else if (msg.includes("UNAUTHORIZED") || msg.includes("Unauthorized")) {
        setError("Väärä käyttäjätunnus tai salasana.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.loginContent,
          isDark && { backgroundColor: "#1e1e1e" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginHeader}>
          <PlatformSymbol
            ios="graduationcap.fill"
            android="school"
            size={52}
            tintColor={isDark ? "#51a2ff" : "#4A89EE"}
          />
          <Text style={[styles.loginTitle, isDark && { color: "#fff" }]}>
            Wilma
          </Text>
          <Text style={[styles.loginSubtitle, isDark && { color: "#aaa" }]}>
            Kirjaudu sisään nähdäksesi lukujärjestyksesi, viestisi ja
            merkintäsi.
          </Text>
        </View>

        <View style={[styles.card, isDark && { backgroundColor: "#303030" }]}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: "#d4d4d4" }]}>
              Käyttäjätunnus
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && {
                  backgroundColor: "#404040",
                  color: "#fff",
                  borderColor: "#555",
                },
              ]}
              placeholder="etunimi.sukunimi"
              placeholderTextColor={isDark ? "#777" : "#aaa"}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, isDark && { color: "#d4d4d4" }]}>
              Salasana
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && {
                  backgroundColor: "#404040",
                  color: "#fff",
                  borderColor: "#555",
                },
              ]}
              placeholder="Salasana"
              placeholderTextColor={isDark ? "#777" : "#aaa"}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
            />
          </View>
          {!!error && (
            <View style={styles.errorBox}>
              <PlatformSymbol
                ios="exclamationmark.circle"
                android="error"
                size={16}
                tintColor="#ff4444"
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <Pressable
            style={[styles.loginBtn, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loginBtnText}>Kirjaudutaan...</Text>
              </View>
            ) : (
              <Text style={styles.loginBtnText}>Kirjaudu sisään</Text>
            )}
          </Pressable>
        </View>

        <View
          style={[styles.noteRow, isDark && { backgroundColor: "#252525" }]}
        >
          <PlatformSymbol
            ios="info.circle"
            android="info"
            size={18}
            tintColor={isDark ? "#888" : "#777"}
          />
          <Text style={[styles.noteText, isDark && { color: "#888" }]}>
            Tunnuksesi tallennetaan vain laitteellesi. Sovellus käyttää niitä
            ainoastaan lukujärjestyksen, viestien ja merkintöjen hakemiseen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

type DashboardData = {
  profile: WilmaStudentProfile;
  lessons: ScheduleLesson[];
  exams: Exam[];
  messages: WilmaMessage[];
  attendance: AttendanceEntry[];
};

function Dashboard({
  isDark,
  onLogout,
}: {
  isDark: boolean;
  onLogout: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setLoadError(null);

      try {
        const [profile, scheduleData, msgs, att] = await Promise.all([
          fetchMe({ forceRefresh: isRefresh }),
          fetchSchedule(undefined, { forceRefresh: isRefresh }),
          fetchMessages("INBOX", { forceRefresh: isRefresh }),
          fetchAttendance(0, { forceRefresh: isRefresh }),
        ]);

        const today = todayISO();
        const weekday = isoWeekday();

        const todaysLessons = scheduleData.schedule
          .filter((l) => l.day === weekday && l.dateArray.includes(today))
          .sort((a, b) => a.start.localeCompare(b.start));

        const upcomingExams = scheduleData.exams
          .filter((e) => finnishToISO(e.date) >= today)
          .sort((a, b) =>
            finnishToISO(a.date).localeCompare(finnishToISO(b.date))
          )
          .slice(0, 3);

        const sortedAtt = [...att]
          .sort((a, b) =>
            finnishToISO(b.date).localeCompare(finnishToISO(a.date))
          )
          .slice(0, 8);

        setData({
          profile,
          lessons: todaysLessons,
          exams: upcomingExams,
          messages: msgs.slice(0, 5),
          attendance: sortedAtt,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Lataus epäonnistui";

        if (msg.includes("UNAUTHENTICATED")) {
          // Token gone and re-auth failed inside gqlFetch – go to login
          clearSession(); // fire and forget
          onLogout();
          return;
        }
        setLoadError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onLogout]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // ── Loading state
  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? "#51a2ff" : "#4A89EE"} />
          <Text style={[styles.loadingLabel, isDark && { color: "#888" }]}>
            Ladataan tietoja...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Connection / load error
  if (loadError) {
    const isNet = isNetworkError(loadError);
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      >
        <View style={styles.centered}>
          <PlatformSymbol
            ios={isNet ? "wifi.slash" : "exclamationmark.circle"}
            android={isNet ? "wifi_off" : "error"}
            size={52}
            tintColor={isDark ? "#555" : "#ccc"}
          />
          <Text style={[styles.errorHeading, isDark && { color: "#d4d4d4" }]}>
            {isNet ? "Ei yhteyttä palvelimeen" : "Lataus epäonnistui"}
          </Text>
          <Text style={[styles.errorBody, isDark && { color: "#888" }]}>
            {isNet
              ? "Tarkista, että GraphQL-palvelin on käynnissä ja olet samassa verkossa."
              : loadError}
          </Text>
          <Pressable
            style={[styles.retryBtn, isDark && { backgroundColor: "#303030" }]}
            onPress={() => load()}
          >
            <PlatformSymbol
              ios="arrow.clockwise"
              android="refresh"
              size={18}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <Text style={[styles.retryBtnText, isDark && { color: "#51a2ff" }]}>
              Yritä uudelleen
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Dashboard
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.dashContent,
          isDark && { backgroundColor: "#1e1e1e" },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#51a2ff" : "#4A89EE"}
          />
        }
      >
        {/* Header */}
        <View style={styles.dashHeader}>
          <View>
            <Text style={[styles.dashGreeting, isDark && { color: "#fff" }]}> 
              Hei, {data?.profile.firstName || "opiskelija"}! 👋
            </Text>
            <Text style={[styles.dashDate, isDark && { color: "#aaa" }]}> 
              {todayFinnish()}
            </Text>
            {!!data?.profile.studentClass && (
              <Text style={[styles.dashClass, isDark && { color: "#888" }]}> 
                Ryhmä {data.profile.studentClass}
              </Text>
            )}
          </View>
        </View>

        {/* Today's lessons */}
        <SectionCard
          title="Tänään"
          onMore={() => router.push("/wilma/schedule")}
          isDark={isDark}
        >
          {!data?.lessons.length ? (
            <EmptyRow label="Ei tunteja tänään" isDark={isDark} />
          ) : (
            data.lessons.map((lesson, i) => {
              const group = lesson.groups[0];
              const room = group?.rooms[0]?.longCaption ?? "";
              const teacher = group?.teachers[0]?.longCaption ?? "";
              const subject = group?.fullCaption ?? lesson.class;
              return (
                <React.Fragment key={lesson.reservationId}>
                  {i > 0 && <Divider isDark={isDark} />}
                  <View style={styles.lessonRow}>
                    <View
                      style={[
                        styles.timeTag,
                        isDark && { backgroundColor: "#4A89EE18" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeTagText,
                          isDark && { color: "#51a2ff" },
                        ]}
                      >
                        {formatTime(lesson.start)}
                      </Text>
                      <Text
                        style={[
                          styles.timeTagSub,
                          isDark && { color: "#51a2ff70" },
                        ]}
                      >
                        {formatTime(lesson.end)}
                      </Text>
                    </View>
                    <View style={styles.lessonInfo}>
                      <Text
                        style={[
                          styles.lessonSubject,
                          isDark && { color: "#fff" },
                        ]}
                        numberOfLines={1}
                      >
                        {subject}
                      </Text>
                      <Text
                        style={[
                          styles.lessonMeta,
                          isDark && { color: "#aaa" },
                        ]}
                        numberOfLines={1}
                      >
                        {[room, teacher].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </SectionCard>

        {/* Upcoming exams */}
        <SectionCard title="Tulevat kokeet" isDark={isDark}>
          {!data?.exams.length ? (
            <EmptyRow label="Ei tulevia kokeita" isDark={isDark} />
          ) : (
            data.exams.map((exam, i) => (
              <React.Fragment key={exam.examId}>
                {i > 0 && <Divider isDark={isDark} />}
                <View style={styles.examRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={[styles.examCourse, isDark && { color: "#fff" }]}
                      numberOfLines={1}
                    >
                      {exam.courseTitle || exam.course}
                    </Text>
                    {exam.name ? (
                      <Text
                        style={[styles.examName, isDark && { color: "#aaa" }]}
                        numberOfLines={1}
                      >
                        {exam.name}
                      </Text>
                    ) : null}
                    {exam.teachers[0] && (
                      <Text
                        style={[styles.examMeta, isDark && { color: "#888" }]}
                        numberOfLines={1}
                      >
                        {exam.teachers[0].teacherName}
                      </Text>
                    )}
                  </View>
                  <View style={styles.examDateBox}>
                    <Text
                      style={[
                        styles.examDate,
                        isDark && { color: "#51a2ff" },
                      ]}
                    >
                      {formatDateFI(exam.date)}
                    </Text>
                    <Text
                      style={[
                        styles.examTime,
                        isDark && { color: "#51a2ff70" },
                      ]}
                    >
                      {formatTime(exam.timeStart)}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))
          )}
        </SectionCard>

        {/* Messages */}
        <SectionCard
          title="Viestit"
          onMore={() => router.push("/wilma/messages")}
          isDark={isDark}
        >
          {!data?.messages.length ? (
            <EmptyRow label="Ei viestejä" isDark={isDark} />
          ) : (
            data.messages.map((msg, i) => (
              <React.Fragment key={msg.id}>
                {i > 0 && <Divider isDark={isDark} />}
                <Pressable
                  style={styles.msgRow}
                  onPress={() =>
                    router.push({
                      pathname: "/wilma/message",
                      params: {
                        id: String(msg.id),
                        subject: msg.subject,
                        sender: msg.senders[0]?.name ?? msg.sender,
                      },
                    })
                  }
                >
                  <View style={styles.msgInfo}>
                    <Text
                      style={[styles.msgSubject, isDark && { color: "#fff" }]}
                      numberOfLines={1}
                    >
                      {msg.subject}
                    </Text>
                    <Text
                      style={[styles.msgSender, isDark && { color: "#aaa" }]}
                      numberOfLines={1}
                    >
                      {msg.senders.map((s) => s.name).join(", ")}
                    </Text>
                  </View>
                  <View style={styles.msgRight}>
                    <Text
                      style={[styles.msgDate, isDark && { color: "#888" }]}
                    >
                      {new Date(
                        msg.timestamp.replace(" ", "T")
                      ).toLocaleDateString("fi-FI", {
                        day: "numeric",
                        month: "numeric",
                      })}
                    </Text>
                    {msg.isEvent && (
                      <View style={styles.eventChip}>
                        <Text style={styles.eventChipText}>Tapahtuma</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </React.Fragment>
            ))
          )}
        </SectionCard>

        {/* Attendance */}
        <SectionCard title="Merkinnät (4 vko)" isDark={isDark}>
          {!data?.attendance.length ? (
            <EmptyRow label="Ei merkintöjä" isDark={isDark} />
          ) : (
            data.attendance.map((entry, i) => {
              const info = ATTENDANCE_COLORS[entry.typeCode] ?? {
                bg: "#aaa",
                label: entry.status,
              };
              return (
                <React.Fragment key={`${entry.date}-${i}`}>
                  {i > 0 && <Divider isDark={isDark} />}
                  <View style={styles.attRow}>
                    <Text
                      style={[styles.attDate, isDark && { color: "#aaa" }]}
                    >
                      {formatDateFI(entry.date)}
                    </Text>
                    <Text
                      style={[
                        styles.attCourse,
                        isDark && { color: "#d4d4d4" },
                      ]}
                      numberOfLines={1}
                    >
                      {entry.course}
                    </Text>
                    <View
                      style={[
                        styles.attChip,
                        { backgroundColor: info.bg + "28" },
                      ]}
                    >
                      <Text
                        style={[styles.attChipText, { color: info.bg }]}
                      >
                        {info.label}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </SectionCard>

        <SectionCard title="Lisää Wilmasta" isDark={isDark}>
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/coursework" as never)}
          >
            <PlatformSymbol
              ios="doc.text"
              android="assignment"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Kurssit ja tehtävät</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Kotitehtävät, tuntipäiväkirja ja kurssikokeet</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/course-selections" as never)}
          >
            <PlatformSymbol
              ios="rectangle.grid.1x2"
              android="view_week"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Kurssivalinnat</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Omat valinnat ja tarjottimet vain luku -tilassa</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/rooms" as never)}
          >
            <PlatformSymbol
              ios="door.left.hand.open"
              android="meeting_room"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Tilojen lukujärjestykset</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Katso milloin luokkahuone on käytössä</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/teachers" as never)}
          >
            <PlatformSymbol
              ios="person.2"
              android="group"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Opettajat ja henkilökunta</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Selaa vastaanottajia ja lähetä viesti</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/news" as never)}
          >
            <PlatformSymbol
              ios="megaphone"
              android="campaign"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Tiedotteet</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Koulun ajankohtaiset tiedotteet</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
          <Divider isDark={isDark} />
          <Pressable
            style={styles.moreWilmaRow}
            onPress={() => router.push("/wilma/grades" as never)}
          >
            <PlatformSymbol
              ios="checkmark.seal"
              android="fact_check"
              size={22}
              tintColor={isDark ? "#51a2ff" : "#4A89EE"}
            />
            <View style={styles.moreWilmaText}>
              <Text style={[styles.moreWilmaTitle, isDark && { color: "#fff" }]}>Arvosanat</Text>
              <Text style={[styles.moreWilmaSubtitle, isDark && { color: "#888" }]}>Kurssisuoritukset, kokeet ja yo-tulokset</Text>
            </View>
            <PlatformSymbol
              ios="chevron.right"
              android="chevron_right"
              size={22}
              tintColor={isDark ? "#555" : "#bbb"}
            />
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────

type SessionState = "checking" | "loggedOut" | "loggedIn";

const STARTUP_TIMEOUT_MS = 8_000;

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    async function init() {
      // If we already have a live token, go straight to the dashboard.
      // The dashboard will handle expired tokens itself via gqlFetch re-auth.
      const token = await getSession();
      if (token) {
        setSessionState("loggedIn");
        return;
      }

      // No active token – try a silent re-auth with a hard deadline so we
      // never block the login form for more than STARTUP_TIMEOUT_MS.
      const timeout = new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), STARTUP_TIMEOUT_MS)
      );
      const ok = await Promise.race([reauthenticate(), timeout]);
      setSessionState(ok ? "loggedIn" : "loggedOut");
    }
    init();
  }, []);

  if (sessionState === "checking") {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, isDark && { backgroundColor: "#1e1e1e" }]}
      >
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={isDark ? "#51a2ff" : "#4A89EE"}
          />
          <Text style={[styles.loadingLabel, isDark && { color: "#888" }]}>
            Tarkistetaan kirjautumista...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionState === "loggedOut") {
    return (
      <LoginView
        isDark={isDark}
        onLogin={() => setSessionState("loggedIn")}
      />
    );
  }

  return (
    <Dashboard
      isDark={isDark}
      onLogout={() => setSessionState("loggedOut")}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  loadingLabel: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },

  // Error state
  errorHeading: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginTop: 4,
  },
  errorBody: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#4A89EE",
  },
  moreWilmaRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  moreWilmaText: { flex: 1 },
  moreWilmaTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  moreWilmaSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },

  // Login
  loginContent: { padding: 20, paddingTop: 40, flexGrow: 1 },
  loginHeader: { alignItems: "center", marginBottom: 28 },
  loginTitle: {
    fontFamily: "Figtree-Bold",
    fontSize: 32,
    color: "#222",
    marginTop: 12,
  },
  loginSubtitle: {
    fontFamily: "Figtree-Regular",
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontFamily: "Figtree-Regular",
    backgroundColor: "#fff",
    color: "#222",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fff0f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#cc2222",
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: "#4A89EE",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontFamily: "Figtree-SemiBold",
    fontSize: 16,
  },
  noteRow: {
    flexDirection: "row",
    backgroundColor: "#f0f7ff",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    gap: 8,
    alignItems: "flex-start",
  },
  noteText: {
    flex: 1,
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },

  // Dashboard
  dashContent: { padding: 16, paddingBottom: 32 },
  dashHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  dashGreeting: {
    fontFamily: "Figtree-Bold",
    fontSize: 28,
    color: "#222",
  },
  dashDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#888",
    marginTop: 2,
    textTransform: "capitalize",
  },
  dashClass: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    color: "#777",
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  cardTitle: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 17,
    color: "#222",
  },
  badge: {
    backgroundColor: "#4A89EE",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontFamily: "Figtree-Bold" },
  moreLink: {
    fontFamily: "Figtree-Medium",
    fontSize: 13,
    color: "#4A89EE",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 10,
  },
  emptyText: {
    fontFamily: "Figtree-Regular",
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    paddingVertical: 8,
  },

  // Lesson
  lessonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeTag: {
    backgroundColor: "#EEF4FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 46,
  },
  timeTagText: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 13,
    color: "#4A89EE",
  },
  timeTagSub: {
    fontFamily: "Figtree-Regular",
    fontSize: 11,
    color: "#4A89EE80",
    marginTop: 1,
  },
  lessonInfo: { flex: 1 },
  lessonSubject: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  lessonMeta: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },

  // Exam
  examRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  examCourse: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  examName: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  examMeta: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#aaa",
    marginTop: 2,
  },
  examDateBox: { alignItems: "flex-end" },
  examDate: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 14,
    color: "#4A89EE",
  },
  examTime: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#4A89EE80",
    marginTop: 2,
  },

  // Messages
  msgRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  msgInfo: { flex: 1 },
  msgSubject: {
    fontFamily: "Figtree-SemiBold",
    fontSize: 15,
    color: "#222",
  },
  msgSender: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  msgRight: { alignItems: "flex-end" },
  msgDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 12,
    color: "#aaa",
  },
  eventChip: {
    backgroundColor: "#4A89EE20",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  eventChipText: {
    fontFamily: "Figtree-Medium",
    fontSize: 10,
    color: "#4A89EE",
  },

  // Attendance
  attRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  attDate: {
    fontFamily: "Figtree-Regular",
    fontSize: 13,
    color: "#888",
    width: 52,
  },
  attCourse: {
    fontFamily: "Figtree-Medium",
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  attChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  attChipText: { fontFamily: "Figtree-Medium", fontSize: 11 },
});
