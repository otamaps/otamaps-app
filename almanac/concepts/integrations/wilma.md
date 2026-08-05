---
title: "Wilma"
summary: "Wilma is the school identity and school-data integration surfaced through onboarding, the home dashboard, schedule, messages, staff directory, news, exams, grades, and attendance."
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
  - id: welcome-index
    type: file
    path: app/welcome/(pre)/index.tsx
  - id: placeholder-login
    type: file
    path: app/(app)/me/wilma/login.tsx
  - id: disabled-tab
    type: file
    path: app/(tabs)/wilma.tsx.dis
---

# Wilma

Wilma is OtaMaps' school identity and school-data integration. It can authenticate a student through the OtaMaps API when Wilma primary auth is enabled, stores Wilma GraphQL session material after the Supabase exchange succeeds, and powers the home dashboard plus auxiliary school-data screens [@auth-broker] [@welcome-index] [@graphql-client]. The active data surface covers profile, schedule, messages, message detail, staff recipients, compose, reply, attendance, news, and past exams or grades [@graphql-client] [@schedule-route] [@messages-route] [@message-route] [@teachers-route] [@compose-route] [@reply-route] [@news-route] [@past-exams-route]. The repository also contains a placeholder login route and a disabled legacy Wilma tab, so future route work should distinguish the active OtaMaps API and GraphQL surface from older or inactive Wilma files [@placeholder-login] [@disabled-tab].

## Product Role

Wilma makes onboarding and the home tab student-specific rather than generic. When `EXPO_PUBLIC_WILMA_PRIMARY_AUTH_ENABLED` is true, the welcome screen asks for Wilma username and password, sends them through the auth broker, and either finishes a Supabase exchange, offers new-account creation, or stores a pending legacy-link attempt before routing to old OtaMaps login [@welcome-index] [@auth-broker]. After a Wilma GraphQL session exists, the home dashboard loads profile, schedule, messages, and attendance in parallel; it derives today's lessons, upcoming exams, the latest five messages, recent attendance entries, a first-name greeting, and a guidance-group line [@home-route] [@graphql-client].

The GraphQL client is the stable integration boundary for school data and message actions. It exposes helpers for login, logout, reauthentication, profile, schedule, messages, message detail, recipients, compose, reply, attendance, news, and past exams, so screens do not construct active GraphQL requests directly [@graphql-client]. The client and its retry behavior are explained in [Wilma GraphQL client and reauth](../../architecture/wilma/graphql-client-and-reauth), while the account-exchange flow is explained in [Wilma auth broker and account linking](../../architecture/wilma/auth-broker-and-account-linking). Exact endpoint and key names belong in [Wilma endpoints and SecureStore keys](../../reference/wilma/endpoints-and-securestore-keys).

## Active Screens

The home tab is the active dashboard entry point. At startup it checks for `wilma_graphql_session`; if no session exists, it races silent reauthentication against an eight-second startup timeout before choosing logged-in or logged-out state [@home-route]. The dashboard then treats authentication failure as a reason to clear the session and return to login, while network or other load errors remain visible with a retry action [@home-route].

The full schedule route fetches month-sized schedule data through `fetchSchedule`, caches each month at module scope, merges adjacent months when a displayed week crosses a month boundary, and lets the user move between week views [@schedule-route]. The message list route calls `fetchMessages`, renders event and reply indicators, offers a compose entrypoint, and pushes a selected message to `/wilma/message` with the message id and header params [@messages-route]. The message detail route calls `fetchMessage`, renders the Wilma HTML body inside a WebView, opens real HTTP or HTTPS links in the system browser instead of navigating inside the WebView, and routes replies to `/wilma/reply` [@message-route] [@reply-route].

The staff directory route calls `fetchMessageRecipients`, filters and sorts recipients, and routes a selected recipient to `/wilma/compose` with Wilma recipient and school ids [@teachers-route] [@compose-route]. The news route reads `fetchNews`, and the past-exams route reads `fetchPastExams` for grade and written-assessment rows [@news-route] [@past-exams-route].

## Inactive And Legacy Surfaces

`app/(app)/me/wilma/login.tsx` is only a placeholder screen that renders static text [@placeholder-login]. It should not be treated as the active login implementation; the active login form is inside `app/(tabs)/home.tsx` [@home-route].

`app/(tabs)/wilma.tsx.dis` is a disabled route file by extension and reflects an older direct Otawilma REST path. It imports `wilmaLogin` and `getWilmaMessages`, uses AsyncStorage key `wilma_saved_credentials`, and only fetches messages plus optional BLE debug location data [@disabled-tab]. The active home dashboard instead imports the GraphQL client, requests schedule, messages, and attendance, and stores Wilma GraphQL session material in SecureStore through that client [@home-route] [@graphql-client]. Use the [main route map](../../architecture/app/main-route-map) when deciding whether a Wilma-looking file participates in navigation.
