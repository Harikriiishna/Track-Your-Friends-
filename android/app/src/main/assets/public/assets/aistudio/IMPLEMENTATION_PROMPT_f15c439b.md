# Prompt: integrate private-room location sharing into my existing Expo app

Paste everything below the line into your AI coding tool. Before you do, copy these
reference files into the project in a folder called `_reference/` (not into src):
`001_mvp_schema.sql`, `002_rls_tests.sql`, `003_storage_policies.sql`,
`004_join_rate_limit.sql`, `005_profile_trigger_and_timestamps.sql`, and the
`expo-app/` folder (app/, lib/, components/, SETUP.md).

---

You are integrating a feature set into my EXISTING Expo / React Native app.
The reference files in `_reference/` are a working design, but they were written for a
fresh project and have never been run. Adapt them to my app. Do not paste them over it.

## Feature to add
Private password-protected rooms; members who opt in share live location (foreground
only); a map shows room members with distance, "last updated", and accuracy. Backend is
Supabase (Postgres + PostGIS + RLS). Privacy is enforced in the database, not the client.

## Hard rules
1. Do NOT rewrite, delete, or restructure existing screens, navigation, auth, or styling.
   Add to them. If something I already have overlaps (auth, profile, navigation), reuse mine.
2. Do NOT invent APIs, package names, props, or SQL. If you aren't sure something exists in
   the installed version, check `node_modules` or the docs, or ask me.
3. Do NOT put the Supabase service_role key anywhere in the app. Anon key only.
4. Do NOT claim anything works unless you ran the check that proves it. Say "not verified"
   when you could not run it.
5. Work in the phases below. Finish and verify one phase before starting the next.
   After each phase, print: what changed, which checks passed, which failed.
6. If a check fails twice, STOP and show me the exact error. Do not keep guessing.
7. Never fabricate data, fake users, or mock locations to make a screen look like it works.

## Phase 0: Inspect (change nothing)
Report back:
- Expo SDK version, React Native version, and whether I use Expo Go or a dev build
- Router in use (expo-router or React Navigation) and the folder layout
- How auth and the Supabase client are currently set up (or whether Supabase is absent)
- Whether TypeScript is used, and the output of `npx tsc --noEmit` and `npx expo-doctor`
  as a baseline, so you can tell which errors are mine and which are new
- Existing packages that overlap with: expo-location, react-native-maps, AsyncStorage
Then list exactly which reference files you will adapt and where they will go. Wait for my OK.

## Phase 1: Database (I run the SQL; you prepare it)
- Check the SQL against my existing Supabase tables. If I already have a `profiles` table or
  similarly named objects, propose a non-destructive migration. Never drop my data.
- Tell me the exact order to run: 001, 004, 005, 003, then 002 as the test gate.
- STOP and wait until I confirm `ALL RLS TESTS PASSED`. Do not build screens on a failing database.

## Phase 2: Dependencies and config
- Install only what is missing, using `npx expo install` for Expo-managed packages so versions
  match my SDK: expo-location, react-native-maps, @react-native-async-storage/async-storage,
  react-native-url-polyfill, and @supabase/supabase-js (npm).
- Add the expo-location permission text and any required plugin entries to app.json.
- Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to `.env` (and `.env.example`).
  Confirm `.env` is in .gitignore.
- Verify: `npx expo-doctor` shows no new problems and the app still starts.

## Phase 3: Core library (no UI yet)
Adapt `lib/supabase.ts`, `lib/geo.ts`, `lib/locationSharing.ts`. If I already have a Supabase
client, extend it instead of creating a second one.
- Verify: `npx tsc --noEmit` has no new errors.

## Phase 4: Rooms screen
Add list / create / join using the `create_room` and `join_room` RPCs. Note `join_room` returns
the text status 'ok' | 'invalid' | 'rate_limited'. Show ONE message for wrong ID and wrong
password. Include loading, empty, and error-with-retry states. Match my existing styling.
- Verify: tsc passes; create a room, then join it from a second account.

## Phase 5: Map screen
Adapt `components/MapSurface.tsx` (the only file that imports the map library) and the map
screen. Required behaviour:
- Distances come from the `room_member_locations` RPC, never from screen pixels.
- "Live" shows only when the SERVER timestamp is under 2 minutes old; otherwise
  "Updated X min ago" / "Last seen ...", with a greyed marker.
- Sharing is OFF by default and expires automatically.
- Show visible banners for: permission denied, GPS/server error, failed load.
- Verify: tsc passes; on two real phones, walk outside and confirm the other phone's marker moves.

## Phase 6: Final report
Give me:
1. Every file you created or changed
2. Every check you ran and its result
3. What you could NOT verify
4. Known gaps (no background tracking, no avatars, no chat yet)
5. Exact steps for me to test on two phones

## Error handling reminder
If I paste an error later, fix the root cause. Do not suppress it with `any`, `@ts-ignore`,
or try/catch that hides the failure.
