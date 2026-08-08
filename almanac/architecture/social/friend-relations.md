---
title: "Friend Relations"
summary: "Friend relations are app-managed Supabase rows whose status and subject-object pair determine requests, accepted friends, removal, and blocking behavior."
topics: [architecture, social, authentication, supabase]
sources:
  - id: friends-handler
    type: file
    path: lib/friendsHandler.ts
  - id: add-friend
    type: file
    path: app/(app)/friends/add.tsx
  - id: requests-route
    type: file
    path: app/(app)/friends/requests.tsx
  - id: map-screen
    type: file
    path: app/(tabs)/map.tsx
---

# Friend Relations

Friend relations are the Supabase-backed relationship rows that make OtaMaps social features work. The app writes `relations` rows with a `subject`, an `object`, and a string status, then queries those rows symmetrically when it needs to treat two users as an unordered pair [@add-friend] [@friends-handler]. Current repo evidence shows request, friends, and blocked statuses in app code, but it does not include a committed migration that proves a database uniqueness constraint for each pair [@add-friend] [@friends-handler].

## Ownership And Entry Points

The relation architecture is split between route code and shared helpers. The add-friend route owns friend-code lookup, duplicate relation checks, request insertion, and inline request handling [@add-friend]. The requests route repeats the incoming-request list and accept/reject operations as a dedicated screen [@requests-route]. `lib/friendsHandler.ts` owns shared reads for current requests, cached friend list composition, friend removal, and the helper that can create a blocked relation [@friends-handler].

The map screen is the main consumer. It refreshes friend data and incoming requests when the map tab focuses, shows a request badge near the add-friend button, renders friend rows in the map bottom sheet, and exposes remove, block, and report actions inside the friend modal [@map-screen]. Those flows depend on the current user id from [session and identity](../auth/session-and-identity).

## Status Transitions

A pending request is created by inserting `{ subject: currentUserId, object: targetUserId, status: "request" }` into `relations` [@add-friend]. The add-friend route refuses to insert when the current user tries to add themselves or when a relation already exists in either direction [@add-friend]. It also changes the button label to "Pyydetty" or "Kaverisi" when the symmetric relation lookup finds an existing request or accepted friendship [@add-friend].

An incoming request is any `relations` row where `status` is `request` and `object` is the current user [@friends-handler] [@requests-route]. Accepting a request updates the matching row to `status: "friends"` using a symmetric `.or(...)` filter. Rejecting deletes the matching row with the same symmetric filter [@add-friend] [@requests-route].

Removing a friend deletes accepted `friends` rows in either direction [@friends-handler]. Blocking is represented by `handleBlockFriend()`, which deletes any existing relation between the users and inserts `{ subject: currentUserId, object: friendId, status: "blocked" }` [@friends-handler]. Searching by code checks for a blocked row where the found user is the subject and the current user is the object, so a user who has been blocked by the target is hidden from add-friend search results [@add-friend].

## Symmetric Pair Queries

The app models relation pairs as directed rows but usually reads them as unordered pairs. Duplicate checks, accept, reject, and removal all use an `.or(...)` filter with both `subject=current, object=other` and `subject=other, object=current` branches [@add-friend] [@requests-route] [@friends-handler]. This is the main invariant future changes need to preserve: relation reads must not assume the current user always appears in one fixed column.

No committed migration in the provided repo evidence defines a unique index for unordered pairs. The add-friend route prevents duplicate insertion by checking for an existing relation before insert, but that is a client-side guard and not proof of database-level uniqueness [@add-friend]. If duplicate rows appear in production, current callers generally read the first relation returned or update/delete all rows that match the symmetric filter [@add-friend] [@friends-handler].

## Friend Lists And Location Consumers

The active friend list is not fetched directly from `relations` in `friendsHandler`. `getFriends()` fetches from `users_ff`, joins those users to rows in `locations`, derives last-seen and room/status fields, caches the resulting array under `cached_friends`, and returns it to the map screen [@friends-handler] [@map-screen]. This makes `users_ff` part of the runtime social data path even though request and blocking transitions are written through `relations` [@friends-handler] [@add-friend].

The map screen separately fetches all `locations` rows, joins them to the current friend list by user id, and renders only friends with coordinates on the selected floor [@map-screen]. Because that lookup is client-side, [friends and shared location](../../concepts/social/friends-and-shared-location) should be read together with the Supabase table reference before changing privacy or location visibility behavior.

## Mismatches And Failure Modes

The most visible mismatch is the map modal block action. `handleBlockFriend()` exists and inserts `status: "blocked"`, but the modal's "Estä" confirmation calls `handleRemoveFriend(friendId)` instead [@friends-handler] [@map-screen]. From this code, pressing the block button on the map removes an accepted friendship but does not create a blocked relation [@map-screen].

Request screens also keep local UI state after mutations. The dedicated requests route removes accepted or rejected requesters from local state after pressing the buttons, while the combined add-friend route's accept/reject helpers do not automatically reload the request list in the shown code path [@requests-route] [@add-friend]. Future relation work should verify both screens, not only the shared helper.

Use [friends and shared location](../../concepts/social/friends-and-shared-location) for the product model and [map social and location tables](../../reference/supabase/map-social-and-location-tables) for exact table-name lookup once changing schema assumptions.
