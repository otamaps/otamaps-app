---
title: "Wilma GraphQL Client And Reauth"
summary: "The Wilma GraphQL client centralizes the OtaMaps API GraphQL endpoint, SecureStore session state, scoped AsyncStorage read caches, timeout handling, broad single-flight reauthentication retries, and typed Wilma data and message actions used by screens."
topics: [architecture, wilma, integrations, observability]
sources:
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: network-errors
    type: file
    path: lib/networkErrors.ts
  - id: sentry-runtime
    type: file
    path: lib/sentry.ts
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: messages-route
    type: file
    path: app/(app)/wilma/messages.tsx
  - id: message-route
    type: file
    path: app/(app)/wilma/message.tsx
  - id: schedule-route
    type: file
    path: app/(app)/wilma/schedule.tsx
  - id: coursework-route
    type: file
    path: app/(app)/wilma/coursework.tsx
  - id: teachers-route
    type: file
    path: app/(app)/wilma/teachers.tsx
  - id: compose-route
    type: file
    path: app/(app)/wilma/compose.tsx
  - id: reply-route
    type: file
    path: app/(app)/wilma/reply.tsx
  - id: news-route
    type: file
    path: app/(app)/wilma/news.tsx
  - id: news-item-route
    type: file
    path: app/(app)/wilma/news-item.tsx
  - id: past-exams-route
    type: file
    path: app/(app)/wilma/past-exams.tsx
  - id: grades-route
    type: file
    path: app/(app)/wilma/grades.tsx
  - id: rooms-route
    type: file
    path: app/(app)/wilma/rooms.tsx
  - id: room-schedule-route
    type: file
    path: app/(app)/wilma/room-schedule.tsx
  - id: course-selections-route
    type: file
    path: app/(app)/wilma/course-selections.tsx
  - id: env-example
    type: file
    path: .env.example
  - id: course-tray-rollout
    type: conversation
    path: /Users/renesaarikko/.codex/sessions/2026/08/09/rollout-2026-08-09T01-56-35-019fe397-a8b7-7ea0-ac45-84bdfaa1f182.jsonl
---

# Wilma GraphQL Client And Reauth

The Wilma GraphQL client is the active network and session boundary for the OtaMaps [Wilma](../../concepts/integrations/wilma) integration. `lib/wilma/graphqlClient.ts` builds its GraphQL URL from `EXPO_PUBLIC_OTAMAPS_API_URL` with an `https://api.otamaps.fi` default, stores the session token and saved credentials in Expo SecureStore, attaches `X-Wilma-Session` to authenticated requests, tries one saved-credential reauthentication plus one retry after a first-attempt request failure, caches read responses under a username-scoped AsyncStorage prefix, and exposes typed helpers for login, logout, profile, schedule, coursework, messages, message detail, recipients, compose, reply, attendance, news, news detail, past exams, gradebook, matriculation results, Wilma rooms, room schedules, selected courses, course trays, and course tray details [@graphql-client]. The home, schedule, coursework, message list, message detail, teacher directory, compose, reply, news, news-detail, past-exam, grades, rooms, room-schedule, and course-selection routes call those helpers instead of owning GraphQL transport themselves [@home-route] [@schedule-route] [@coursework-route] [@messages-route] [@message-route] [@teachers-route] [@compose-route] [@reply-route] [@news-route] [@news-item-route] [@past-exams-route] [@grades-route] [@rooms-route] [@room-schedule-route] [@course-selections-route].

## Client Boundary

`gqlFetch` is the core fetcher. It builds a JSON GraphQL POST body, reads the stored session token, adds `X-Wilma-Session` when the token exists, sends the request through `fetchWithTimeout`, parses the JSON response, and returns `json.data` as the caller's typed result [@graphql-client]. Errors are normalized at the same layer. Fetch failures, invalid JSON or HTML responses, HTTP errors, GraphQL errors, and missing `data` on a first attempt all call `reauthenticate()` and retry the original request once when saved-credential login succeeds [@graphql-client]. Invalid responses, HTTP failures, GraphQL errors, and missing-data cases are also reported through the shared Sentry handled-error helper with operation, retry, status, and GraphQL code tags before the retry or stale-session cleanup proceeds [@graphql-client] [@sentry-runtime].

The timeout wrapper is intentionally shared by login and data requests. `fetchWithTimeout` aborts requests after ten seconds by default and throws a Finnish `FetchTimeoutError` with code `ETIMEDOUT` when the shared network helper recognizes the abort as a fetch cancellation [@graphql-client] [@network-errors]. `_doReauth` passes a twelve-second timeout because the login operation is expected to do more HTTP work behind the GraphQL server [@graphql-client]. `.env.example` describes `EXPO_PUBLIC_OTAMAPS_API_URL` as the API host for both GraphQL and the Wilma-to-Supabase auth exchange, so endpoint changes affect this client and the [Wilma auth broker and account linking](auth-broker-and-account-linking) flow together [@env-example].

## Read Cache

Read helpers use `cachedGqlFetch` rather than calling `gqlFetch` directly. The cache scope is a SHA-256 digest of the API base URL and the saved Wilma username, so cached school data is separated by backend origin and credential identity [@graphql-client]. Cache entries are stored in memory and in AsyncStorage under `wilma_read_cache_v1:<scope>:<cacheKey>`, wrapped as `{ version: 1, storedAt, data }` envelopes [@graphql-client]. Missing credentials bypass the cache because there is no scope [@graphql-client].

The cache is stale-while-revalidate for reads. If a cached entry exists and the caller did not request `forceRefresh`, the client returns it immediately; expired entries also start a background refresh, and failed refreshes fall back to cached data unless the error is a Wilma authentication error [@graphql-client]. Write helpers invalidate related read keys: `sendWilmaMessage` clears cached message lists and message details, while `replyToWilmaMessage` clears message lists plus the replied message detail [@graphql-client].

TTL values are per data family. Profile lasts six hours, schedule and coursework last fifteen minutes, message lists last two minutes, message and news detail last twenty-four hours, recipients and rooms last twenty-four hours, attendance lasts ten minutes, news lasts fifteen minutes, grade and matriculation data lasts one hour, room schedules last fifteen minutes, and selected-course, course-tray, and course-tray-detail data last thirty minutes [@graphql-client]. `clearAll()` removes the session, credentials, and all cache entries for the current scope, which makes full Wilma logout stronger than just deleting the SecureStore token [@graphql-client].

## Session And Reauthentication Flow

The client separates a short-lived session token from saved credentials. `saveSession`, `getSession`, and `clearSession` manage `wilma_graphql_session`, while `saveCredentials`, `getCredentials`, and `clearCredentials` manage `wilma_graphql_credentials` as a JSON `{ username, password }` object [@graphql-client]. `clearAll` deletes both stores, and `logoutMutation` calls the GraphQL logout mutation but clears both stores in `finally`, so local logout cleanup does not depend on a successful server response [@graphql-client].

Reauthentication is single-flight. A module-level `_reauthFlight` holds the current reauthentication promise, and `reauthenticate` returns that promise to parallel callers until `_doReauth` finishes [@graphql-client]. `_doReauth` reads stored credentials, sends a login mutation directly through `fetchWithTimeout`, saves the returned `sessionToken`, and returns `false` if credentials are missing, login data is incomplete, or the request throws [@graphql-client]. When a first-attempt data request fails, `gqlFetch` calls `reauthenticate`; a successful result retries the original GraphQL request once, while an authentication error after failed reauthentication clears only the stale session token before throwing `WilmaAuthenticationError` [@graphql-client].

The home route adds a startup rule on top of the client. On mount, it uses an existing session token immediately when one is present; without a token, it races `reauthenticate()` against an eight-second timeout and shows the login screen if silent reauth does not finish successfully [@home-route]. During dashboard loading, the same route catches an `UNAUTHENTICATED` message by clearing the session and returning to the login state [@home-route].

## Data Requests

The data helpers define the active Wilma data model for screens. `fetchMe` returns student id, role, base URL, first name, last name, display name, and guidance group or class [@graphql-client]. The home dashboard calls it with schedule, messages, and attendance, then uses the first name for the greeting and `studentClass` for the `Ryhmä` line [@home-route].

`fetchSchedule` runs `query Schedule($date: String)` and returns lessons plus exams, including reservation ids, weekday numbers, start/end times, lesson groups, teachers, rooms, exam ids, exam dates, exam times, and teachers [@graphql-client]. The schedule route builds on this by fetching month data with `fetchSchedule("1.<month>.<year>")`, caching each month in module memory, and merging two months when the visible week crosses a month boundary [@schedule-route]. `fetchCoursework` uses the same `schedule(date:)` query family to return course metadata, teachers, homework, diary entries, and exams; the coursework route flattens those nested rows into dated schoolwork items [@graphql-client] [@coursework-route].

`fetchMessages` requests inbox message rows with ids, subjects, timestamps, folders, senders, event flags, reply counts, and applying status [@graphql-client]. The message list route calls it on load and refresh, while the home dashboard slices the result to the latest five messages [@messages-route] [@home-route]. `fetchMessage` runs `query Message($id: Int!)` for a selected message's id, subject, and HTML body, and the detail route renders that HTML in a WebView [@graphql-client] [@message-route].

`fetchMessageRecipients` returns the authenticated recipient directory with recipient ids, school ids, names, codes, categories, and an `isOwnTeacher` flag [@graphql-client]. The teacher directory route fetches that list, filters by name/code/category with Finnish locale lowercasing, sorts own teachers first, and routes a selected recipient to compose with both ids in params [@teachers-route]. `sendWilmaMessage` submits recipient id, school id, subject, and body, and the compose screen validates params, requires non-empty subject and body, and shows a confirmation dialog before sending [@graphql-client] [@compose-route].

`replyToWilmaMessage` runs the reply mutation with message id and body, and the message detail screen routes to `/wilma/reply` with the selected message id, subject, and sender [@graphql-client] [@message-route] [@reply-route]. `fetchAttendance` runs `query Attendance($range: Int)` and returns attendance entries with date, course, status, teacher, teacher code, type code, and excused status [@graphql-client]. The home dashboard calls `fetchAttendance(0)`, sorts recent entries by converted Finnish dates, and labels the section `Merkinnät (4 vko)` [@home-route].

`fetchNews` returns school news with title, date, excerpt, teacher metadata, and permanence, while `fetchNewsItem` returns the selected news item's HTML body for the detail route [@graphql-client] [@news-route] [@news-item-route]. `fetchPastExams` returns the last-year exam and grade rows shown by the past-exams route; `fetchGradebook` and `fetchMatriculationResults` feed the grades route with subject/course grades, credit summaries, and matriculation rows [@graphql-client] [@past-exams-route] [@grades-route].

`fetchWilmaRooms` and `fetchWilmaRoomSchedule` are separate from the app's Supabase-backed campus map room data. They expose Wilma room profiles and room lesson schedules for the Wilma room screens, while the map's room model remains documented under [campus map model](../../concepts/map/campus-map-model) [@graphql-client] [@rooms-route] [@room-schedule-route]. `fetchSelectedCourses` and `fetchCourseTrays` feed the course-selection route with selected group codes, periods, bars, trays, and tray availability metadata [@graphql-client] [@course-selections-route]. `fetchCourseTray(id)` expands one tray into bars and courses with code, name, teacher, selected, locked, full, completed, and grade fields; the course-selection screen lazily loads this detail on tray expansion, caches it per tray id, and keeps the UI read-only with retry controls for detail failures [@graphql-client] [@course-selections-route].

## Change Constraints

The GraphQL URL is environment-configured with a production default, not a route-local constant [@graphql-client]. Any change to `EXPO_PUBLIC_OTAMAPS_API_URL` must update the client, the auth broker, and the lookup reference together, because screens currently assume this client is the single active GraphQL boundary [@graphql-client] [@env-example]. The endpoint and SecureStore contract are listed in [Wilma endpoints and SecureStore keys](../../reference/wilma/endpoints-and-securestore-keys), and route placement is summarized in the [main route map](../app/main-route-map).

Verify backend schema support before relying on newly added GraphQL helpers in production. The 2026-08-09 course-tray-detail implementation recorded the app-side `courseTray(id)` client and an isolated sibling backend branch, but also recorded that production `api.otamaps.fi` did not yet expose `courseTray` until that backend branch is deployed [@course-tray-rollout]. The current client helper list and the backend field list are tracked separately in [Wilma endpoints and SecureStore keys](../../reference/wilma/endpoints-and-securestore-keys), because adding a client helper can otherwise make screens look more production-ready than the API schema actually is.
