---
title: "Wilma Endpoints And SecureStore Keys"
summary: "This reference lists the active OtaMaps API Wilma endpoints, GraphQL operations, SecureStore keys, account connection route, direct Otawilma REST leftovers, and disabled route evidence."
topics: [reference, wilma, integrations, storage]
sources:
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: auth-broker
    type: file
    path: lib/wilma/authBroker.ts
  - id: direct-login
    type: file
    path: lib/wilma/owLoginHandler.ts
  - id: direct-requests
    type: file
    path: lib/wilma/wilmaRequestHandlers.ts
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
  - id: placeholder-login
    type: file
    path: app/(app)/me/wilma/login.tsx
  - id: account-route
    type: file
    path: app/(app)/me/wilma/index.tsx
  - id: teacher-schedule-route
    type: file
    path: app/(app)/wilma/teacher-schedule.tsx
  - id: disabled-tab
    type: file
    path: app/(tabs)/wilma.tsx.dis
  - id: env-example
    type: file
    path: .env.example
  - id: eas-config
    type: file
    path: eas.json
  - id: course-tray-rollout
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
  - id: production-schema-session
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/11/rollout-2026-08-11T23-40-23-019ff28e-0e0c-7383-be65-1ff5a35ceaa4.jsonl
---

# Wilma Endpoints And SecureStore Keys

This reference lists the exact Wilma endpoint constants, SecureStore keys, and operations visible in the current OtaMaps code. The active [Wilma](../../concepts/integrations/wilma) path uses the OtaMaps API for both GraphQL and Wilma-to-Supabase authentication exchange: `lib/wilma/graphqlClient.ts` builds `${API_BASE_URL}/graphql`, and `lib/wilma/authBroker.ts` posts to `/v1/auth/wilma/*` paths under the same API base [@graphql-client] [@auth-broker]. Separate direct Otawilma REST helpers still exist, but their only route consumer in the cited files is `app/(tabs)/wilma.tsx.dis`, a disabled tab file [@direct-login] [@direct-requests] [@disabled-tab].

## API Base

| Setting Or Default | Owner | Active Surface | Purpose |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_OTAMAPS_API_URL` | `lib/wilma/graphqlClient.ts`, `lib/wilma/authBroker.ts` | Active Wilma GraphQL screens and Wilma primary-auth flow | Base URL for GraphQL and Wilma-to-Supabase auth exchange [@graphql-client] [@auth-broker]. |
| `https://api.otamaps.fi` | `lib/wilma/graphqlClient.ts`, `lib/wilma/authBroker.ts`, `.env.example`, `eas.json` | Default and committed EAS profile value | Production API default after trimming any trailing slash [@graphql-client] [@auth-broker] [@env-example] [@eas-config]. |
| `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` | `lib/wilma/authBroker.ts`, `app/welcome/(pre)/index.tsx` | Welcome screen Wilma login visibility | Enables the Wilma username/password primary-auth form unless the value is exactly `"false"` [@auth-broker] [@welcome-index]. |

The active GraphQL URL is not a hardcoded LAN address. It is `${(EXPO_PUBLIC_OTAMAPS_API_URL || "https://api.otamaps.fi").replace(/\/$/, "")}/graphql` [@graphql-client]. The auth broker uses the same API-base expression for `/v1/auth/wilma/start`, `/v1/auth/wilma/create`, and `/v1/auth/wilma/link-legacy` [@auth-broker].

## Active OtaMaps API Paths

| Path | Method | Owner | Purpose |
| --- | --- | --- | --- |
| `/graphql` | POST | `lib/wilma/graphqlClient.ts` | Sends login, logout, `me`, schedule, coursework, messages, message detail, recipients, teacher-schedule, compose, reply, attendance, news, news-detail, past-exam, gradebook, matriculation, room, room-schedule, selected-course, course-tray list, and course-tray detail GraphQL requests [@graphql-client]. |
| `/v1/auth/wilma/start` | POST | `lib/wilma/authBroker.ts` | Starts Wilma credential verification and returns either a Supabase session exchange or a legacy-match attempt token [@auth-broker]. |
| `/v1/auth/wilma/create` | POST | `lib/wilma/authBroker.ts` | Creates a new OtaMaps account from a Wilma-authenticated legacy-match attempt token [@auth-broker]. |
| `/v1/auth/wilma/link-legacy` | POST with Supabase bearer token | `lib/wilma/authBroker.ts` | Links a pending Wilma attempt to an already signed-in legacy Supabase account [@auth-broker]. |
| `/v1/auth/wilma/connect` | POST with Supabase bearer token | `lib/wilma/authBroker.ts`, `app/(app)/me/wilma/index.tsx` | Connects or refreshes Wilma credentials for the currently signed-in Supabase user, then saves the GraphQL session and credentials after verifying the expected user id [@auth-broker] [@account-route]. |

## Active SecureStore Keys

| Key | Owner | Stored Value | Clearing Rule |
| --- | --- | --- | --- |
| `wilma_graphql_session` | `lib/wilma/graphqlClient.ts`, `lib/wilma/authBroker.ts` | Wilma GraphQL session token | `clearSession` deletes this key; `clearAll` deletes it with credentials; successful broker exchange and link flows write it [@graphql-client] [@auth-broker]. |
| `wilma_graphql_credentials` | `lib/wilma/graphqlClient.ts`, `lib/wilma/authBroker.ts` | JSON `{ username, password }` used for silent reauthentication | `clearCredentials` deletes this key; `clearAll` deletes it with the session; successful broker exchange and link flows write it [@graphql-client] [@auth-broker]. |
| `wilma_legacy_link_attempt` | `lib/wilma/authBroker.ts` | JSON `{ attemptToken, username, password }` for a Wilma-authenticated possible legacy-account match | Cleared after successful Supabase exchange, successful legacy link, malformed JSON, sign-out cleanup, or failed link cleanup [@auth-broker]. |

`loginMutation` saves both GraphQL keys after a successful GraphQL login, while `logoutMutation` clears both keys in `finally` after attempting the GraphQL logout mutation [@graphql-client]. `finishWilmaSupabaseExchange` and `completePendingLegacyLink` also save the GraphQL keys after they verify the expected Supabase user id [@auth-broker].

## GraphQL Operations

| Helper | Operation | Variables | Returned Shape Used By App |
| --- | --- | --- | --- |
| `loginMutation` | `mutation Login($username: String!, $password: String!)` | `username`, `password` | `sessionToken`, `role`, `studentId`, and `baseUrl` [@graphql-client]. |
| `_doReauth` | `mutation Login($u: String!, $p: String!)` | saved `username`, saved `password` | `sessionToken` only, saved back to `wilma_graphql_session` [@graphql-client]. |
| `logoutMutation` | `mutation { logout }` | none | Boolean logout response, ignored by local cleanup [@graphql-client]. |
| `fetchMe` | `{ me { studentId role baseUrl firstName lastName displayName studentClass } }` | none | Student profile used for greeting and guidance group/class display [@graphql-client] [@home-route]. |
| `fetchSchedule` | `query Schedule($date: String)` | optional `date` | Lessons under `schedule.schedule` and exams under `schedule.exams` [@graphql-client]. |
| `fetchCoursework` | `query Coursework($date: String)` | optional `date` | Courses with teachers, homework, diary entries, and course exams under `schedule.courses` [@graphql-client]. |
| `fetchMessages` | `query Messages($folder: MessageFolder!)` | `folder: INBOX \| OUTBOX \| APPOINTMENTS` | Message rows with sender, recipient, unread, event, reply count, and applying fields for the selected folder [@graphql-client]. |
| `fetchMessage` | `query Message($id: Int!)` | `id` | Message id, subject, timestamp, sender, recipient, HTML body, and, when the backend exposes it, chronological reply bodies [@graphql-client]. |
| `fetchMessageRecipients` | anonymous `{ messageRecipients { ... } }` query | none | Recipient rows with id, school id, name, code, category, and own-teacher flag [@graphql-client]. |
| `sendWilmaMessage` | `mutation SendMessage($recipientId: Int!, $schoolId: Int!, $subject: String!, $body: String!)` | `recipientId`, `schoolId`, `subject`, `body` | Boolean send confirmation [@graphql-client]. |
| `replyToWilmaMessage` | `mutation ReplyMessage($messageId: Int!, $body: String!)` | `messageId`, `body` | Boolean reply confirmation [@graphql-client]. |
| `fetchAttendance` | `query Attendance($range: Int)` | optional `range` | Attendance entries with date, course, teacher, type, and excused fields [@graphql-client]. |
| `fetchNews` | anonymous `{ news { ... } }` query | none | School news rows with date, excerpt, teacher metadata, and permanence [@graphql-client]. |
| `fetchNewsItem` | `query NewsItem($id: Int!)` | `id` | News item id, title, and HTML body [@graphql-client]. |
| `fetchPastExams` | anonymous `{ pastExams { ... } }` query | none | Last-year exam or grade rows with teacher, grade, details, and written assessment [@graphql-client]. |
| `fetchGradebook` | anonymous `{ gradebook { ... } }` query | none | Summary rows plus subject and course grade rows with credits, completion date, and teacher [@graphql-client]. |
| `fetchMatriculationResults` | anonymous `{ matriculationResults { ... } }` query | none | Matriculation rows with subject, completion date, compulsory flag, grade, rejected reason, and points [@graphql-client]. |
| `fetchWilmaRooms` | anonymous `{ rooms { id code name } }` query | none | Wilma room profiles, separate from the Supabase campus-map room table [@graphql-client]. |
| `fetchWilmaRoomSchedule` | `query RoomSchedule($roomId: Int!, $date: String)` | `roomId`, optional `date` | Room profile and lessons with groups and teachers [@graphql-client]. |
| `fetchWilmaTeacherSchedule` | `query TeacherSchedule($teacherId: Int!, $date: String)` | `teacherId`, optional `date` | Teacher profile and weekly lessons; route UI capability-gates this surface before showing the schedule button, then `/wilma/teacher-schedule` fetches the selected teacher and week [@graphql-client] [@teacher-schedule-route]. |
| `fetchWilmaQueryCapabilities` | `query TypeCapabilities($name: String!)` for `Query` | none | Root GraphQL field set used to capability-gate staggered app/API rollouts [@graphql-client]. |
| `fetchSelectedCourses` | anonymous `{ selectedCourses { ... } }` query | none | Selected course group code, period, bar, and tray rows [@graphql-client]. |
| `fetchCourseTrays` | anonymous `{ courseTrays { ... } }` query | none | Course tray id, category, name, status, and closed flag [@graphql-client]. |
| `fetchCourseTray` | `query CourseTray($id: String!)` | `id` | One tray with bars and courses, including course code, name, teacher, selected, locked, full, completed, and grade fields [@graphql-client]. |

Every active GraphQL helper uses the same timeout-aware POST path through the client. The request mechanics and retry behavior are described in [Wilma GraphQL client and reauth](../../architecture/wilma/graphql-client-and-reauth), and the Supabase exchange is described in [Wilma auth broker and account linking](../../architecture/wilma/auth-broker-and-account-linking).

## Backend Schema Boundary

This reference lists client helpers, not a guarantee that the deployed or sibling backend exposes every helper's field. Client helpers added in `lib/wilma/graphqlClient.ts` require backend schema verification before they are treated as production-supported [@graphql-client]. This matters most for helpers whose root GraphQL fields were added after the original login, schedule, message, attendance, news, and recipient surfaces, because app-side support can land before the production API field does [@graphql-client] [@course-tray-rollout].

Production schema support can lag behind this client reference. The 2026-08-09 course-tray-detail implementation recorded app-side support for `fetchCourseTray` and a sibling backend branch, while production `api.otamaps.fi` still lacked the `courseTray` field until that backend branch is deployed [@course-tray-rollout]. The 2026-08-11 production incident showed the same risk for message folders: production rejected the client's `messages(folder: MessageFolder!)` shape until the full-schema Wilma API image was deployed and a credentialed read sweep passed all app queries [@production-schema-session].

## Direct REST Leftovers

| Endpoint | Owner | Active Surface | Purpose |
| --- | --- | --- | --- |
| `https://wilma.otawilma.fi/api/login` | `lib/wilma/owLoginHandler.ts` | Direct REST helper; disabled tab path | Sends a JSON username/password login request and stores returned token data in SecureStore when a token is present [@direct-login] [@disabled-tab]. |
| `https://wilma.otawilma.fi/api/messages/inbox/?limit=100` | `lib/wilma/wilmaRequestHandlers.ts` | Direct REST helper; disabled tab path | Fetches up to 100 inbox messages with the stored direct REST token and caches the JSON response [@direct-requests] [@disabled-tab]. |

| Key | Owner | Stored Value | Clearing Rule |
| --- | --- | --- | --- |
| `wilma_token` | `lib/wilma/owLoginHandler.ts` | Token from the direct Otawilma login response | `clearWilmaLogin` deletes it with username and login time [@direct-login]. |
| `wilma_username` | `lib/wilma/owLoginHandler.ts` | Username used for the direct Otawilma login request | `clearWilmaLogin` deletes it [@direct-login]. |
| `wilma_login_time` | `lib/wilma/owLoginHandler.ts` | Login timestamp stored as `String(Date.now())` | `clearWilmaLogin` deletes it [@direct-login]. |
| `wilma_messages` | `lib/wilma/wilmaRequestHandlers.ts` | Cached JSON response from the direct inbox endpoint | Valid for 30 minutes when paired with `wilma_messages_time` [@direct-requests]. |
| `wilma_messages_time` | `lib/wilma/wilmaRequestHandlers.ts` | Millisecond timestamp for `wilma_messages` | `clearWilmaMessagesCache` deletes it with cached messages [@direct-requests]. |

These direct keys are separate from the active GraphQL keys. The direct helpers do not write `wilma_graphql_session`, `wilma_graphql_credentials`, or `wilma_legacy_link_attempt`, and the GraphQL client does not read `wilma_token` [@graphql-client] [@auth-broker] [@direct-login].

## Account, Redirect, And Disabled Route Evidence

`app/(app)/me/wilma/index.tsx` is an active Wilma account connection route. It reads `profile_source` through user preferences, shows whether Wilma is connected, and calls `connectWilmaAccount` to connect or update the current user's Wilma session material [@account-route] [@auth-broker]. `app/(app)/me/wilma/login.tsx` is only a redirect to `/me/wilma` [@placeholder-login].

`app/(tabs)/wilma.tsx.dis` imports the direct REST login and message helpers, stores `wilma_saved_credentials` in AsyncStorage, handles direct 401 relogin, displays direct message rows, and includes debug-mode BLE location display [@disabled-tab]. Because the file extension is `.tsx.dis`, it should be treated as disabled route evidence rather than the active Wilma tab implementation. The active Wilma dashboard lives in `app/(tabs)/home.tsx`, and Wilma primary auth begins in `app/welcome/(pre)/index.tsx` when enabled [@home-route] [@welcome-index].
