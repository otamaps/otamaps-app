import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { sha256 } from "js-sha256";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_OTAMAPS_API_URL || "https://api.otamaps.fi"
).replace(/\/$/, "");
const GRAPHQL_URL = `${API_BASE_URL}/graphql`;
const SESSION_KEY = "wilma_graphql_session";
const CREDENTIALS_KEY = "wilma_graphql_credentials";
const CACHE_PREFIX = "wilma_read_cache_v1:";

export type WilmaFetchOptions = {
  /** Skip cache-first behavior and wait for a fresh network response. */
  forceRefresh?: boolean;
};

const CACHE_TTL = {
  profile: 6 * 60 * 60_000,
  schedule: 15 * 60_000,
  messages: 2 * 60_000,
  messageDetail: 24 * 60 * 60_000,
  recipients: 24 * 60 * 60_000,
  attendance: 10 * 60_000,
  news: 15 * 60_000,
  newsDetail: 24 * 60 * 60_000,
  grades: 60 * 60_000,
  rooms: 24 * 60 * 60_000,
  roomSchedule: 15 * 60_000,
  courseSelections: 30 * 60_000,
} as const;

type CacheEnvelope<T> = {
  version: 1;
  storedAt: number;
  data: T;
};

const cacheMemory = new Map<string, CacheEnvelope<unknown>>();
const cacheFlights = new Map<string, Promise<unknown>>();
const cacheRevisions = new Map<string, number>();
let cacheScopeMemo: string | null | undefined;

function cacheScopeForUsername(username: string): string {
  return sha256(`${API_BASE_URL}|${username.trim().toLocaleLowerCase("fi-FI")}`).slice(0, 24);
}

async function getCacheScope(): Promise<string | null> {
  if (cacheScopeMemo !== undefined) return cacheScopeMemo;
  const credentials = await getCredentials();
  cacheScopeMemo = credentials ? cacheScopeForUsername(credentials.username) : null;
  return cacheScopeMemo;
}

async function readCache<T>(storageKey: string): Promise<CacheEnvelope<T> | null> {
  const memory = cacheMemory.get(storageKey) as CacheEnvelope<T> | undefined;
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== 1 || !Number.isFinite(parsed.storedAt)) {
      await AsyncStorage.removeItem(storageKey);
      return null;
    }
    cacheMemory.set(storageKey, parsed as CacheEnvelope<unknown>);
    return parsed;
  } catch {
    await AsyncStorage.removeItem(storageKey).catch(() => undefined);
    return null;
  }
}

async function loadAndCache<T>(storageKey: string, loader: () => Promise<T>): Promise<T> {
  const active = cacheFlights.get(storageKey) as Promise<T> | undefined;
  if (active) return active;

  const revision = cacheRevisions.get(storageKey) ?? 0;
  const flight = loader()
    .then(async (data) => {
      if ((cacheRevisions.get(storageKey) ?? 0) !== revision) return data;
      const envelope: CacheEnvelope<T> = { version: 1, storedAt: Date.now(), data };
      cacheMemory.set(storageKey, envelope as CacheEnvelope<unknown>);
      await AsyncStorage.setItem(storageKey, JSON.stringify(envelope)).catch(() => undefined);
      if ((cacheRevisions.get(storageKey) ?? 0) !== revision) {
        cacheMemory.delete(storageKey);
        await AsyncStorage.removeItem(storageKey).catch(() => undefined);
      }
      return data;
    })
    .finally(() => {
      cacheFlights.delete(storageKey);
    });
  cacheFlights.set(storageKey, flight as Promise<unknown>);
  return flight;
}

async function cachedRead<T>(
  cacheKey: string,
  maxAgeMs: number,
  loader: () => Promise<T>,
  options: WilmaFetchOptions = {}
): Promise<T> {
  const scope = await getCacheScope();
  if (!scope) return loader();

  const storageKey = `${CACHE_PREFIX}${scope}:${cacheKey}`;
  const cached = await readCache<T>(storageKey);
  if (cached && !options.forceRefresh) {
    if (Date.now() - cached.storedAt > maxAgeMs) {
      void loadAndCache(storageKey, loader).catch(() => undefined);
    }
    return cached.data;
  }

  try {
    return await loadAndCache(storageKey, loader);
  } catch (error) {
    if (cached && (error as Error)?.name !== "WilmaAuthenticationError") {
      return cached.data;
    }
    throw error;
  }
}

async function invalidateWilmaCache(cacheKeyPrefixes: string[]): Promise<void> {
  const scope = await getCacheScope();
  if (!scope) return;
  const scopedPrefix = `${CACHE_PREFIX}${scope}:`;
  const matches = (key: string) =>
    cacheKeyPrefixes.some((prefix) => key.startsWith(`${scopedPrefix}${prefix}`));
  const keys = new Set(
    [...cacheMemory.keys(), ...cacheFlights.keys()].filter(matches)
  );
  try {
    (await AsyncStorage.getAllKeys()).filter(matches).forEach((key) => keys.add(key));
  } catch {
    // Memory and in-flight keys are still invalidated below.
  }
  for (const key of keys) {
    cacheMemory.delete(key);
    cacheRevisions.set(key, (cacheRevisions.get(key) ?? 0) + 1);
  }
  if (keys.size) await AsyncStorage.multiRemove([...keys]).catch(() => undefined);
}

async function clearWilmaCache(scope: string | null): Promise<void> {
  if (!scope) return;
  const prefix = `${CACHE_PREFIX}${scope}:`;
  const matches = (key: string) => key.startsWith(prefix);
  const keys = new Set(
    [...cacheMemory.keys(), ...cacheFlights.keys()].filter(matches)
  );
  try {
    (await AsyncStorage.getAllKeys()).filter(matches).forEach((key) => keys.add(key));
  } catch {
    // Memory and in-flight keys are still invalidated below.
  }
  for (const key of keys) {
    cacheMemory.delete(key);
    cacheRevisions.set(key, (cacheRevisions.get(key) ?? 0) + 1);
  }
  if (keys.size) await AsyncStorage.multiRemove([...keys]).catch(() => undefined);
}

// ── Timeout-aware fetch ───────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Yhteyden muodostaminen aikakatkaistiin – tarkista, että palvelin on käynnissä ja olet samassa verkossa.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function saveSession(token: string) {
  await SecureStore.setItemAsync(SESSION_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ── Credentials ───────────────────────────────────────────────────────────────

export async function saveCredentials(username: string, password: string) {
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ username, password }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  );
  const nextScope = cacheScopeForUsername(username);
  if (cacheScopeMemo !== undefined && cacheScopeMemo !== nextScope) cacheMemory.clear();
  cacheScopeMemo = nextScope;
}

export async function getCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  cacheScopeMemo = null;
}

/** Clear both session token and saved credentials (full sign-out). */
export async function clearAll() {
  const scope = await getCacheScope();
  await Promise.all([clearSession(), clearCredentials(), clearWilmaCache(scope)]);
}

// ── Re-authentication (single-flight) ─────────────────────────────────────────
//
// When multiple requests fail at once with UNAUTHENTICATED, they all hit this
// function simultaneously. We de-duplicate so only one login attempt is made
// and every caller shares the same result.

let _reauthFlight: Promise<boolean> | null = null;

async function _doReauth(): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds) return false;
  try {
    const res = await fetchWithTimeout(
      GRAPHQL_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Login($u: String!, $p: String!) {
            login(username: $u, password: $p) { sessionToken }
          }`,
          variables: { u: creds.username, p: creds.password },
        }),
      },
      12_000 // slightly longer than normal requests – login does 5 HTTP hops
    );
    const json = await res.json();
    const token: string | undefined = json.data?.login?.sessionToken;
    if (!token) return false;
    await saveSession(token);
    return true;
  } catch {
    return false;
  }
}

/** Silently re-login using stored credentials. Safe to call in parallel. */
export function reauthenticate(): Promise<boolean> {
  if (_reauthFlight) return _reauthFlight;
  _reauthFlight = _doReauth().finally(() => {
    _reauthFlight = null;
  });
  return _reauthFlight;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function gqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  _isRetry = false
): Promise<T> {
  const token = await getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["X-Wilma-Session"] = token;

  let res: Response;
  try {
    res = await fetchWithTimeout(GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    // Network / timeout errors – bubble up immediately, no retry
    throw err;
  }

  const json = await res.json();

  if (json.errors?.length) {
    const err = json.errors[0];
    const code: string | undefined = err.extensions?.code;
    const isAuthError =
      code === "UNAUTHENTICATED" ||
      res.status === 401 ||
      res.status === 403;

    if (isAuthError) {
      if (!_isRetry) {
        const ok = await reauthenticate();
        if (ok) return gqlFetch<T>(query, variables, true);
      }
      // Re-auth failed – wipe session so login screen appears. Cached data must
      // not hide an authentication failure and keep the user in a stale session.
      await clearSession();
      const authError = new Error(err.message ?? "Wilma-istunto on vanhentunut");
      authError.name = "WilmaAuthenticationError";
      throw authError;
    }

    throw new Error(err.message ?? "GraphQL-virhe");
  }

  return json.data as T;
}

function cachedGqlFetch<T>(
  cacheKey: string,
  maxAgeMs: number,
  query: string,
  variables?: Record<string, unknown>,
  options?: WilmaFetchOptions
): Promise<T> {
  return cachedRead(
    cacheKey,
    maxAgeMs,
    () => gqlFetch<T>(query, variables),
    options
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type LoginResult = {
  sessionToken: string;
  role: string;
  studentId: number;
  baseUrl: string;
};

export async function loginMutation(
  username: string,
  password: string
): Promise<LoginResult> {
  // Login goes through gqlFetch so it benefits from timeout + error parsing.
  // It won't trigger re-auth loop because there's no UNAUTHENTICATED on login.
  const data = await gqlFetch<{ login: LoginResult }>(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        sessionToken role studentId baseUrl
      }
    }`,
    { username, password }
  );
  await saveSession(data.login.sessionToken);
  await saveCredentials(username, password);
  return data.login;
}

export async function logoutMutation(): Promise<void> {
  try {
    await gqlFetch<{ logout: boolean }>(`mutation { logout }`);
  } finally {
    await clearAll();
  }
}

export type WilmaStudentProfile = {
  studentId: number;
  role: string;
  baseUrl: string;
  firstName: string;
  lastName: string;
  displayName: string;
  studentClass: string;
};

export async function fetchMe(options: WilmaFetchOptions = {}): Promise<WilmaStudentProfile> {
  const data = await cachedGqlFetch<{ me: WilmaStudentProfile }>(
    "profile",
    CACHE_TTL.profile,
    `{ me {
      studentId role baseUrl firstName lastName displayName studentClass
    } }`,
    undefined,
    options
  );
  return data.me;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export type ScheduleLesson = {
  reservationId: number;
  day: number;
  start: string;
  end: string;
  class: string;
  dateArray: string[];
  groups: {
    shortCaption: string;
    fullCaption: string;
    teachers: { longCaption: string }[];
    rooms: { longCaption: string }[];
  }[];
};

export type Exam = {
  examId: number;
  course: string;
  courseTitle: string;
  name?: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  info?: string;
  teachers: { teacherName: string; teacherCode: string }[];
};

export type ScheduleData = {
  schedule: ScheduleLesson[];
  exams: Exam[];
};

export type WilmaCourse = {
  id: number;
  courseId: number;
  courseName: string;
  courseCode: string;
  name: string;
  caption: string;
  startDate: string;
  endDate: string;
  committed: boolean;
  teachers: { teacherId: number; teacherName: string; teacherCode: string }[];
  homework: { rowNumber: number; date: string; homework: string }[];
  diary: {
    rowNumber: number;
    date: string;
    lesson: string;
    note: string;
    teacherName: string;
    teacherCode: string;
  }[];
  exams: {
    id: number;
    date: string;
    name: string | null;
    caption: string | null;
    timeStart: string | null;
    timeEnd: string | null;
    topic: string | null;
    info: string | null;
  }[];
};

export async function fetchSchedule(
  date?: string,
  options: WilmaFetchOptions = {}
): Promise<ScheduleData> {
  const data = await cachedGqlFetch<{ schedule: ScheduleData }>(
    `schedule:${date ?? "current"}`,
    CACHE_TTL.schedule,
    `query Schedule($date: String) {
      schedule(date: $date) {
        schedule {
          reservationId day start end class dateArray
          groups {
            shortCaption fullCaption
            teachers { longCaption }
            rooms { longCaption }
          }
        }
        exams {
          examId course courseTitle name date timeStart timeEnd info
          teachers { teacherName teacherCode }
        }
      }
    }`,
    date ? { date } : {},
    options
  );
  return data.schedule;
}

export async function fetchCoursework(
  date?: string,
  options: WilmaFetchOptions = {}
): Promise<WilmaCourse[]> {
  const data = await cachedGqlFetch<{ schedule: { courses: WilmaCourse[] } }>(
    `coursework:${date ?? "current"}`,
    CACHE_TTL.schedule,
    `query Coursework($date: String) {
      schedule(date: $date) {
        courses {
          id courseId courseName courseCode name caption
          startDate endDate committed
          teachers { teacherId teacherName teacherCode }
          homework { rowNumber date homework }
          diary { rowNumber date lesson note teacherName teacherCode }
          exams { id date name caption timeStart timeEnd topic info }
        }
      }
    }`,
    date ? { date } : {},
    options
  );
  return data.schedule.courses;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export type WilmaMessage = {
  id: number;
  subject: string;
  timestamp: string;
  folder: string;
  sender: string;
  senders: { name: string; href: string }[];
  recipient: string;
  recipients: { name: string; href: string }[];
  isUnread: boolean;
  isEvent: boolean;
  replies: number;
  applying: { status: string; extraInfo: string } | null;
};

export type WilmaMessageFolder = "INBOX" | "OUTBOX" | "APPOINTMENTS";

export async function fetchMessages(
  folder: WilmaMessageFolder = "INBOX",
  options: WilmaFetchOptions = {}
): Promise<WilmaMessage[]> {
  const data = await cachedGqlFetch<{ messages: { messages: WilmaMessage[] } }>(
    `messages:${folder}`,
    CACHE_TTL.messages,
    `query Messages($folder: MessageFolder!) {
      messages(folder: $folder) { messages {
        id subject timestamp folder sender recipient isUnread
        senders { name href }
        recipients { name href }
        isEvent replies
        applying { status extraInfo }
      } }
    }`,
    { folder },
    options
  );
  return data.messages.messages;
}

export type MessageDetail = {
  id: number | null;
  subject: string | null;
  htmlBody: string | null;
};

export async function fetchMessage(
  id: number,
  options: WilmaFetchOptions = {}
): Promise<MessageDetail> {
  const data = await cachedGqlFetch<{ message: MessageDetail }>(
    `message:${id}`,
    CACHE_TTL.messageDetail,
    `query Message($id: Int!) {
      message(id: $id) { id subject htmlBody }
    }`,
    { id },
    options
  );
  return data.message;
}

export type WilmaMessageRecipient = {
  id: number;
  schoolId: number;
  name: string;
  code: string;
  category: string;
  isOwnTeacher: boolean;
};

export async function fetchMessageRecipients(
  options: WilmaFetchOptions = {}
): Promise<WilmaMessageRecipient[]> {
  const data = await cachedGqlFetch<{ messageRecipients: WilmaMessageRecipient[] }>(
    "messageRecipients",
    CACHE_TTL.recipients,
    `{ messageRecipients {
      id schoolId name code category isOwnTeacher
    } }`,
    undefined,
    options
  );
  return data.messageRecipients;
}

export async function sendWilmaMessage(input: {
  recipientId: number;
  schoolId: number;
  subject: string;
  body: string;
}): Promise<boolean> {
  const data = await gqlFetch<{ sendMessage: boolean }>(
    `mutation SendMessage(
      $recipientId: Int!
      $schoolId: Int!
      $subject: String!
      $body: String!
    ) {
      sendMessage(
        recipientId: $recipientId
        schoolId: $schoolId
        subject: $subject
        body: $body
      )
    }`,
    input
  );
  await invalidateWilmaCache(["messages:", "message:"]);
  return data.sendMessage;
}

export async function replyToWilmaMessage(
  messageId: number,
  body: string
): Promise<boolean> {
  const data = await gqlFetch<{ replyMessage: boolean }>(
    `mutation ReplyMessage($messageId: Int!, $body: String!) {
      replyMessage(messageId: $messageId, body: $body)
    }`,
    { messageId, body }
  );
  await invalidateWilmaCache(["messages:", `message:${messageId}`]);
  return data.replyMessage;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export type AttendanceEntry = {
  date: string;
  course: string;
  status: string;
  teacher: string;
  teacherCode: string;
  typeCode: number;
  excused: boolean;
};

export async function fetchAttendance(
  range?: number,
  options: WilmaFetchOptions = {}
): Promise<AttendanceEntry[]> {
  const data = await cachedGqlFetch<{ attendance: { entries: AttendanceEntry[] } }>(
    `attendance:${range ?? "default"}`,
    CACHE_TTL.attendance,
    `query Attendance($range: Int) {
      attendance(range: $range) {
        entries { date course status teacher teacherCode typeCode excused }
      }
    }`,
    range !== undefined ? { range } : {},
    options
  );
  return data.attendance.entries;
}

// ── News ──────────────────────────────────────────────────────────────────────

export type WilmaNewsItem = {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  teacherCode: string;
  teacherName: string;
  isPermanent: boolean;
};

export async function fetchNews(options: WilmaFetchOptions = {}): Promise<WilmaNewsItem[]> {
  const data = await cachedGqlFetch<{ news: WilmaNewsItem[] }>(
    "news",
    CACHE_TTL.news,
    `{ news {
      id title date excerpt teacherCode teacherName isPermanent
    } }`,
    undefined,
    options
  );
  return data.news;
}

export type WilmaNewsDetail = {
  id: number;
  title: string;
  htmlBody: string;
};

export async function fetchNewsItem(
  id: number,
  options: WilmaFetchOptions = {}
): Promise<WilmaNewsDetail> {
  const data = await cachedGqlFetch<{ newsItem: WilmaNewsDetail }>(
    `newsItem:${id}`,
    CACHE_TTL.newsDetail,
    `query NewsItem($id: Int!) {
      newsItem(id: $id) { id title htmlBody }
    }`,
    { id },
    options
  );
  return data.newsItem;
}

// ── Past exams and grades ─────────────────────────────────────────────────────

export type WilmaPastExam = {
  date: string;
  teacherCode: string;
  teacherName: string;
  examTitle: string;
  details: string;
  grade: string;
  writtenAssessment: string;
};

export async function fetchPastExams(
  options: WilmaFetchOptions = {}
): Promise<WilmaPastExam[]> {
  const data = await cachedGqlFetch<{ pastExams: WilmaPastExam[] }>(
    "pastExams",
    CACHE_TTL.grades,
    `{ pastExams {
      date teacherCode teacherName examTitle details grade writtenAssessment
    } }`,
    undefined,
    options
  );
  return data.pastExams;
}

export type WilmaGradeCourse = {
  code: string;
  name: string;
  grade: string;
  credits: string;
  completedOn: string;
  teacher: string;
};

export type WilmaGradeSubject = {
  name: string;
  grade: string;
  credits: string;
  courses: WilmaGradeCourse[];
};

export type WilmaGradebook = {
  summary: { label: string; value: string }[];
  subjects: WilmaGradeSubject[];
};

export type WilmaMatriculationResult = {
  subject: string;
  completedOn: string;
  compulsory: string;
  grade: string;
  rejectedReason: string;
  points: string;
};

export async function fetchGradebook(
  options: WilmaFetchOptions = {}
): Promise<WilmaGradebook> {
  const data = await cachedGqlFetch<{ gradebook: WilmaGradebook }>(
    "gradebook",
    CACHE_TTL.grades,
    `{ gradebook {
      summary { label value }
      subjects {
        name grade credits
        courses { code name grade credits completedOn teacher }
      }
    } }`,
    undefined,
    options
  );
  return data.gradebook;
}

export async function fetchMatriculationResults(
  options: WilmaFetchOptions = {}
): Promise<WilmaMatriculationResult[]> {
  const data = await cachedGqlFetch<{ matriculationResults: WilmaMatriculationResult[] }>(
    "matriculationResults",
    CACHE_TTL.grades,
    `{ matriculationResults {
      subject completedOn compulsory grade rejectedReason points
    } }`,
    undefined,
    options
  );
  return data.matriculationResults;
}

export type WilmaRoomProfile = { id: number; code: string; name: string };
export type WilmaRoomSchedule = {
  room: WilmaRoomProfile;
  lessons: {
    day: number;
    start: string;
    end: string;
    groups: {
      code: string;
      name: string;
      teachers: { id: number; code: string; name: string }[];
    }[];
  }[];
};

export async function fetchWilmaRooms(
  options: WilmaFetchOptions = {}
): Promise<WilmaRoomProfile[]> {
  const data = await cachedGqlFetch<{ rooms: WilmaRoomProfile[] }>(
    "rooms",
    CACHE_TTL.rooms,
    `{ rooms { id code name } }`,
    undefined,
    options
  );
  return data.rooms;
}

export async function fetchWilmaRoomSchedule(
  roomId: number,
  date?: string,
  options: WilmaFetchOptions = {}
): Promise<WilmaRoomSchedule> {
  const data = await cachedGqlFetch<{ roomSchedule: WilmaRoomSchedule }>(
    `roomSchedule:${roomId}:${date ?? "current"}`,
    CACHE_TTL.roomSchedule,
    `query RoomSchedule($roomId: Int!, $date: String) {
      roomSchedule(roomId: $roomId, date: $date) {
        room { id code name }
        lessons {
          day start end
          groups { code name teachers { id code name } }
        }
      }
    }`,
    date ? { roomId, date } : { roomId },
    options
  );
  return data.roomSchedule;
}

export type WilmaSelectedCourse = {
  groupCode: string;
  period: string;
  bar: string;
  tray: string;
};

export type WilmaCourseTray = {
  id: string;
  category: string;
  name: string;
  status: string;
  closed: boolean;
};

export async function fetchSelectedCourses(
  options: WilmaFetchOptions = {}
): Promise<WilmaSelectedCourse[]> {
  const data = await cachedGqlFetch<{ selectedCourses: WilmaSelectedCourse[] }>(
    "selectedCourses",
    CACHE_TTL.courseSelections,
    `{ selectedCourses { groupCode period bar tray } }`,
    undefined,
    options
  );
  return data.selectedCourses;
}

export async function fetchCourseTrays(
  options: WilmaFetchOptions = {}
): Promise<WilmaCourseTray[]> {
  const data = await cachedGqlFetch<{ courseTrays: WilmaCourseTray[] }>(
    "courseTrays",
    CACHE_TTL.courseSelections,
    `{ courseTrays { id category name status closed } }`,
    undefined,
    options
  );
  return data.courseTrays;
}
