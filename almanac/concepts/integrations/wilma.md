---
title: "Wilma"
summary: "Wilma is the school identity and school-data integration surfaced through onboarding, the home dashboard, schedule, coursework, messages, staff directory, news, exams, grades, rooms, course selections, course tray details, and attendance."
topics: [concepts, wilma, integrations]
sources:
  - id: home-route
    type: file
    path: app/(tabs)/home.tsx
  - id: graphql-client
    type: file
    path: lib/wilma/graphqlClient.ts
  - id: auth-broker
    type: file
    path: lib/wilma/authBroker.ts
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
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
  - id: account-route
    type: file
    path: app/(app)/me/wilma/index.tsx
  - id: login-redirect
    type: file
    path: app/(app)/me/wilma/login.tsx
  - id: disabled-tab
    type: file
    path: app/(tabs)/wilma.tsx.dis
---

# Wilma

Wilma is OtaMaps' school identity and school-data integration. It can authenticate a student through the OtaMaps API when Wilma primary auth is enabled, connect or refresh Wilma credentials from account settings, store Wilma GraphQL session material after the Supabase exchange succeeds, and power the home dashboard plus auxiliary school-data screens [@auth-broker] [@welcome-index] [@account-route] [@graphql-client]. The active data surface covers profile, schedule, coursework, messages, message detail, staff recipients, compose, reply, attendance, news, news detail, past exams, gradebook, matriculation results, Wilma rooms, room schedules, selected courses, course trays, and course tray details [@graphql-client] [@schedule-route] [@coursework-route] [@messages-route] [@message-route] [@teachers-route] [@compose-route] [@reply-route] [@news-route] [@news-item-route] [@past-exams-route] [@grades-route] [@rooms-route] [@room-schedule-route] [@course-selections-route]. The repository also contains a compatibility redirect and a disabled legacy Wilma tab, so future route work should distinguish the active OtaMaps API and GraphQL surface from older or inactive Wilma files [@login-redirect] [@disabled-tab].

## Product Role

Wilma makes onboarding and the home tab student-specific rather than generic. Unless `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` is exactly `"false"`, the welcome screen asks for Wilma username and password, sends them through the auth broker, and either finishes a Supabase exchange, offers new-account creation, or stores a pending legacy-link attempt before routing to old OtaMaps login [@welcome-index] [@auth-broker]. After a Wilma GraphQL session exists, the home dashboard loads profile, schedule, messages, and attendance in parallel; it derives today's lessons, upcoming exams, the latest five messages, recent attendance entries, a first-name greeting, and a guidance-group line [@home-route] [@graphql-client].

The GraphQL client is the stable integration boundary for school data and message actions. It exposes helpers for login, logout, reauthentication, profile, schedule, coursework, messages, message detail, recipients, compose, reply, attendance, news, news detail, past exams, gradebook, matriculation results, Wilma rooms, room schedules, selected courses, course trays, and course tray details, so screens do not construct active GraphQL requests directly [@graphql-client]. The client, its cache, and its retry behavior are explained in [Wilma GraphQL client and reauth](../../architecture/wilma/graphql-client-and-reauth), while the account-exchange flow is explained in [Wilma auth broker and account linking](../../architecture/wilma/auth-broker-and-account-linking). Exact endpoint and key names belong in [Wilma endpoints and SecureStore keys](../../reference/wilma/endpoints-and-securestore-keys).

## Active Screens

The home tab is the active dashboard entry point. At startup it checks for `wilma_graphql_session`; if no session exists, it races silent reauthentication against an eight-second startup timeout before choosing logged-in or logged-out state [@home-route]. The dashboard then treats authentication failure as a reason to clear the session and return to login, while network or other load errors remain visible with a retry action [@home-route].

The full schedule route fetches month-sized schedule data through `fetchSchedule`, caches each month at module scope, merges adjacent months when a displayed week crosses a month boundary, and lets the user move between week views [@schedule-route]. The coursework route calls `fetchCoursework` and flattens homework, diary entries, and exams into dated schoolwork items [@coursework-route] [@graphql-client]. The message list route calls `fetchMessages`, renders event and reply indicators, offers a compose entrypoint, and pushes a selected message to `/wilma/message` with the message id and header params [@messages-route]. The message detail route calls `fetchMessage`, renders the Wilma HTML body inside a WebView, opens real HTTP or HTTPS links in the system browser instead of navigating inside the WebView, and routes replies to `/wilma/reply` [@message-route] [@reply-route].

The staff directory route calls `fetchMessageRecipients`, filters and sorts recipients, and routes a selected recipient to `/wilma/compose` with Wilma recipient and school ids [@teachers-route] [@compose-route]. The news route reads `fetchNews`, and the past-exams route reads `fetchPastExams` for grade and written-assessment rows [@news-route] [@past-exams-route].

Grades, rooms, and course selections are separate auxiliary surfaces. The grades route reads `fetchGradebook` and `fetchMatriculationResults`, and it links back to the past-exams route for older exam rows [@grades-route] [@graphql-client] [@past-exams-route]. The rooms route reads `fetchWilmaRooms` and pushes a selected room into `room-schedule`, where `fetchWilmaRoomSchedule` loads lesson reservations for that room [@rooms-route] [@room-schedule-route] [@graphql-client]. The course-selection route reads `fetchSelectedCourses` and `fetchCourseTrays` for current selections and available trays, then lazily calls `fetchCourseTray` when a tray is expanded to show its bars, courses, teachers, selection state, locked/full/completed flags, and grades without adding course-selection mutations [@course-selections-route] [@graphql-client].

## Account, Redirect, And Legacy Surfaces

`app/(app)/me/wilma/index.tsx` is an active account surface. It loads the user's preferences and `users` row, treats `profile_source === "wilma"` as the connected state, and calls `connectWilmaAccount` to connect or update the Wilma credentials for the current Supabase user [@account-route] [@auth-broker]. `app/(app)/me/wilma/login.tsx` only redirects to that screen [@login-redirect]. Neither route replaces the pre-auth Wilma primary login in `app/welcome/(pre)/index.tsx` or the dashboard login state inside `app/(tabs)/home.tsx` [@welcome-index] [@home-route].

`app/(tabs)/wilma.tsx.dis` is a disabled route file by extension and reflects an older direct Otawilma REST path. It imports `wilmaLogin` and `getWilmaMessages`, uses AsyncStorage key `wilma_saved_credentials`, and only fetches messages plus optional BLE debug location data [@disabled-tab]. The active home dashboard instead imports the GraphQL client, requests schedule, messages, and attendance, and stores Wilma GraphQL session material in SecureStore through that client [@home-route] [@graphql-client]. Use the [main route map](../../architecture/app/main-route-map) when deciding whether a Wilma-looking file participates in navigation.
