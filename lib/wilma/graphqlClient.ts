import * as SecureStore from "expo-secure-store";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_OTAMAPS_API_URL || "https://api.otamaps.fi"
).replace(/\/$/, "");
const GRAPHQL_URL = `${API_BASE_URL}/graphql`;
const SESSION_KEY = "wilma_graphql_session";
const CREDENTIALS_KEY = "wilma_graphql_credentials";

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
}

/** Clear both session token and saved credentials (full sign-out). */
export async function clearAll() {
  await Promise.all([clearSession(), clearCredentials()]);
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

    if (isAuthError && !_isRetry) {
      const ok = await reauthenticate();
      if (ok) return gqlFetch<T>(query, variables, true);
      // Re-auth failed – wipe session so login screen appears
      await clearSession();
    }

    throw new Error(err.message ?? "GraphQL-virhe");
  }

  return json.data as T;
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

export async function fetchMe(): Promise<WilmaStudentProfile> {
  const data = await gqlFetch<{ me: WilmaStudentProfile }>(
    `{ me {
      studentId role baseUrl firstName lastName displayName studentClass
    } }`
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

export async function fetchSchedule(date?: string): Promise<ScheduleData> {
  const data = await gqlFetch<{ schedule: ScheduleData }>(
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
    date ? { date } : {}
  );
  return data.schedule;
}

export async function fetchCoursework(date?: string): Promise<WilmaCourse[]> {
  const data = await gqlFetch<{ schedule: { courses: WilmaCourse[] } }>(
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
    date ? { date } : {}
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
  folder: WilmaMessageFolder = "INBOX"
): Promise<WilmaMessage[]> {
  const data = await gqlFetch<{ messages: { messages: WilmaMessage[] } }>(
    `query Messages($folder: MessageFolder!) {
      messages(folder: $folder) { messages {
        id subject timestamp folder sender recipient isUnread
        senders { name href }
        recipients { name href }
        isEvent replies
        applying { status extraInfo }
      } }
    }`,
    { folder }
  );
  return data.messages.messages;
}

export type MessageDetail = {
  id: number | null;
  subject: string | null;
  htmlBody: string | null;
};

export async function fetchMessage(id: number): Promise<MessageDetail> {
  const data = await gqlFetch<{ message: MessageDetail }>(
    `query Message($id: Int!) {
      message(id: $id) { id subject htmlBody }
    }`,
    { id }
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

export async function fetchMessageRecipients(): Promise<WilmaMessageRecipient[]> {
  const data = await gqlFetch<{ messageRecipients: WilmaMessageRecipient[] }>(
    `{ messageRecipients {
      id schoolId name code category isOwnTeacher
    } }`
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
  range?: number
): Promise<AttendanceEntry[]> {
  const data = await gqlFetch<{ attendance: { entries: AttendanceEntry[] } }>(
    `query Attendance($range: Int) {
      attendance(range: $range) {
        entries { date course status teacher teacherCode typeCode excused }
      }
    }`,
    range !== undefined ? { range } : {}
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

export async function fetchNews(): Promise<WilmaNewsItem[]> {
  const data = await gqlFetch<{ news: WilmaNewsItem[] }>(
    `{ news {
      id title date excerpt teacherCode teacherName isPermanent
    } }`
  );
  return data.news;
}

export type WilmaNewsDetail = {
  id: number;
  title: string;
  htmlBody: string;
};

export async function fetchNewsItem(id: number): Promise<WilmaNewsDetail> {
  const data = await gqlFetch<{ newsItem: WilmaNewsDetail }>(
    `query NewsItem($id: Int!) {
      newsItem(id: $id) { id title htmlBody }
    }`,
    { id }
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

export async function fetchPastExams(): Promise<WilmaPastExam[]> {
  const data = await gqlFetch<{ pastExams: WilmaPastExam[] }>(
    `{ pastExams {
      date teacherCode teacherName examTitle details grade writtenAssessment
    } }`
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

export async function fetchGradebook(): Promise<WilmaGradebook> {
  const data = await gqlFetch<{ gradebook: WilmaGradebook }>(
    `{ gradebook {
      summary { label value }
      subjects {
        name grade credits
        courses { code name grade credits completedOn teacher }
      }
    } }`
  );
  return data.gradebook;
}

export async function fetchMatriculationResults(): Promise<WilmaMatriculationResult[]> {
  const data = await gqlFetch<{ matriculationResults: WilmaMatriculationResult[] }>(
    `{ matriculationResults {
      subject completedOn compulsory grade rejectedReason points
    } }`
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

export async function fetchWilmaRooms(): Promise<WilmaRoomProfile[]> {
  const data = await gqlFetch<{ rooms: WilmaRoomProfile[] }>(`{ rooms { id code name } }`);
  return data.rooms;
}

export async function fetchWilmaRoomSchedule(
  roomId: number,
  date?: string
): Promise<WilmaRoomSchedule> {
  const data = await gqlFetch<{ roomSchedule: WilmaRoomSchedule }>(
    `query RoomSchedule($roomId: Int!, $date: String) {
      roomSchedule(roomId: $roomId, date: $date) {
        room { id code name }
        lessons {
          day start end
          groups { code name teachers { id code name } }
        }
      }
    }`,
    date ? { roomId, date } : { roomId }
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

export async function fetchSelectedCourses(): Promise<WilmaSelectedCourse[]> {
  const data = await gqlFetch<{ selectedCourses: WilmaSelectedCourse[] }>(
    `{ selectedCourses { groupCode period bar tray } }`
  );
  return data.selectedCourses;
}

export async function fetchCourseTrays(): Promise<WilmaCourseTray[]> {
  const data = await gqlFetch<{ courseTrays: WilmaCourseTray[] }>(
    `{ courseTrays { id category name status closed } }`
  );
  return data.courseTrays;
}
