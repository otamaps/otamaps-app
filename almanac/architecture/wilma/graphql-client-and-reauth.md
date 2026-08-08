---
title: "Wilma GraphQL Client And Reauth"
summary: "The Wilma GraphQL client centralizes the OtaMaps API GraphQL endpoint, SecureStore session state, timeout handling, single-flight reauthentication, and typed data and message actions used by Wilma screens."
topics: [architecture, wilma, integrations]
sources:
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
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
  - id: past-exams-route
    type: file
    path: app/(app)/wilma/past-exams.tsx
  - id: env-example
    type: file
    path: .env.example
---

# Wilma GraphQL Client And Reauth

The Wilma GraphQL client is the active network and session boundary for the OtaMaps [Wilma](../../concepts/integrations/wilma) integration. `lib/wilma/graphqlClient.ts` builds its GraphQL URL from `EXPO_PUBLIC_OTAMAPS_API_URL` with an `https://api.otamaps.fi` default, stores the session token and saved credentials in Expo SecureStore, attaches `X-Wilma-Session` to authenticated requests, retries one time after an authentication error, and exposes typed helpers for login, logout, profile, schedule, messages, message detail, recipients, compose, reply, attendance, news, and past exams [@graphql-client]. The home, schedule, message list, message detail, teacher directory, compose, reply, news, and past-exam routes call those helpers instead of owning GraphQL transport themselves [@home-route] [@schedule-route] [@messages-route] [@message-route] [@teachers-route] [@compose-route] [@reply-route] [@news-route] [@past-exams-route].

## Client Boundary

`gqlFetch` is the core fetcher. It builds a JSON GraphQL POST body, reads the stored session token, adds `X-Wilma-Session` when the token exists, sends the request through `fetchWithTimeout`, parses the JSON response, and returns `json.data` as the caller's typed result [@graphql-client]. Errors are normalized at the same layer: GraphQL errors become thrown JavaScript errors, and `UNAUTHENTICATED`, HTTP `401`, and HTTP `403` trigger the reauthentication path when the request is not already a retry [@graphql-client].

The timeout wrapper is intentionally shared by login and data requests. `fetchWithTimeout` aborts requests after ten seconds by default and throws a Finnish timeout message for `AbortError`; `_doReauth` passes a twelve-second timeout because the login operation is expected to do more HTTP work behind the GraphQL server [@graphql-client]. `.env.example` describes `EXPO_PUBLIC_OTAMAPS_API_URL` as the API host for both GraphQL and the Wilma-to-Supabase auth exchange, so endpoint changes affect this client and the [Wilma auth broker and account linking](auth-broker-and-account-linking) flow together [@env-example].

## Session And Reauthentication Flow

The client separates a short-lived session token from saved credentials. `saveSession`, `getSession`, and `clearSession` manage `wilma_graphql_session`, while `saveCredentials`, `getCredentials`, and `clearCredentials` manage `wilma_graphql_credentials` as a JSON `{ username, password }` object [@graphql-client]. `clearAll` deletes both stores, and `logoutMutation` calls the GraphQL logout mutation but clears both stores in `finally`, so local logout cleanup does not depend on a successful server response [@graphql-client].

Reauthentication is single-flight. A module-level `_reauthFlight` holds the current reauthentication promise, and `reauthenticate` returns that promise to parallel callers until `_doReauth` finishes [@graphql-client]. `_doReauth` reads stored credentials, sends a login mutation directly through `fetchWithTimeout`, saves the returned `sessionToken`, and returns `false` if credentials are missing, login data is incomplete, or the request throws [@graphql-client]. When `gqlFetch` sees an auth error, it calls `reauthenticate`; a successful result retries the original GraphQL request once, while failure clears only the stale session token before throwing the original GraphQL error message [@graphql-client].

The home route adds a startup rule on top of the client. On mount, it uses an existing session token immediately when one is present; without a token, it races `reauthenticate()` against an eight-second timeout and shows the login screen if silent reauth does not finish successfully [@home-route]. During dashboard loading, the same route catches an `UNAUTHENTICATED` message by clearing the session and returning to the login state [@home-route].

## Data Requests

The data helpers define the active Wilma data model for screens. `fetchMe` returns student id, role, base URL, first name, last name, display name, and guidance group or class [@graphql-client]. The home dashboard calls it with schedule, messages, and attendance, then uses the first name for the greeting and `studentClass` for the `Ryhmä` line [@home-route].

`fetchSchedule` runs `query Schedule($date: String)` and returns lessons plus exams, including reservation ids, weekday numbers, start/end times, lesson groups, teachers, rooms, exam ids, exam dates, exam times, and teachers [@graphql-client]. The schedule route builds on this by fetching month data with `fetchSchedule("1.<month>.<year>")`, caching each month in module memory, and merging two months when the visible week crosses a month boundary [@schedule-route].

`fetchMessages` requests inbox message rows with ids, subjects, timestamps, folders, senders, event flags, reply counts, and applying status [@graphql-client]. The message list route calls it on load and refresh, while the home dashboard slices the result to the latest five messages [@messages-route] [@home-route]. `fetchMessage` runs `query Message($id: Int!)` for a selected message's id, subject, and HTML body, and the detail route renders that HTML in a WebView [@graphql-client] [@message-route].

`fetchMessageRecipients` returns the authenticated recipient directory with recipient ids, school ids, names, codes, categories, and an `isOwnTeacher` flag [@graphql-client]. The teacher directory route fetches that list, filters by name/code/category with Finnish locale lowercasing, sorts own teachers first, and routes a selected recipient to compose with both ids in params [@teachers-route]. `sendWilmaMessage` submits recipient id, school id, subject, and body, and the compose screen validates params, requires non-empty subject and body, and shows a confirmation dialog before sending [@graphql-client] [@compose-route].

`replyToWilmaMessage` runs the reply mutation with message id and body, and the message detail screen routes to `/wilma/reply` with the selected message id, subject, and sender [@graphql-client] [@message-route] [@reply-route]. `fetchAttendance` runs `query Attendance($range: Int)` and returns attendance entries with date, course, status, teacher, teacher code, type code, and excused status [@graphql-client]. The home dashboard calls `fetchAttendance(0)`, sorts recent entries by converted Finnish dates, and labels the section `Merkinnät (4 vko)` [@home-route].

`fetchNews` returns school news with title, date, excerpt, teacher metadata, and permanence, while `fetchPastExams` returns the last-year exam and grade rows shown by the news and past-exams routes [@graphql-client] [@news-route] [@past-exams-route].

## Change Constraints

The GraphQL URL is environment-configured with a production default, not a route-local constant [@graphql-client]. Any change to `EXPO_PUBLIC_OTAMAPS_API_URL` must update the client, the auth broker, and the lookup reference together, because screens currently assume this client is the single active GraphQL boundary [@graphql-client] [@env-example]. The endpoint and SecureStore contract are listed in [Wilma endpoints and SecureStore keys](../../reference/wilma/endpoints-and-securestore-keys), and route placement is summarized in the [main route map](../app/main-route-map).
