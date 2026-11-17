# Gather Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Master Catch-All**: Every path not explicitly matched in `/users/{userId}`, `/subscriptions/{subscriptionId}`, `/scheduledShows/{showId}`, or `/customScenes/{sceneId}` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: Every authenticated read/write requires `request.auth != null && request.auth.token.email_verified == true`. Unverified email claims are rejected.
3. **PII & Owner Isolation (`/users`, `/subscriptions`, `/customScenes`)**:
   - `/users/{userId}` documents contain creator payout handles and email; only `request.auth.uid == userId` may `get`, `create`, `update`, or `delete`. `list` is strictly `false`.
   - `/subscriptions/{subscriptionId}` contains `subscriberEmail`. Only the owning subscriber (`subscriberUid == request.auth.uid`) or the target authenticated host (`hostUid == request.auth.uid`) may read or list matching documents.
   - `/customScenes/{sceneId}` stores owner-isolated Studio scene presets (`ownerUid == request.auth.uid`), enforcing bounded native array guarding (`elements is list && elements.size() >= 1 && elements.size() <= 12 && elements[0] is map`) and rule-side `allow list` query enforcement (`existing().ownerUid == request.auth.uid`).
4. **Deterministic Path Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) enforces `isValidId(...)` (`1..128` chars, `^[a-zA-Z0-9_\-]+$`), and `/subscriptions/{subscriptionId}` enforces `subscriptionId == hostKey + '_' + subscriberUid`.
5. **Temporal & Immutable Integrity**: `createdAt == request.time` on `create`; `createdAt == resource.data.createdAt` and `updatedAt == request.time` on `update`. Identity keys (`uid`, `subscriberUid`, `hostUid`, `hostKey`, `ownerUid`) are immutable after creation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Spoof**: `{ uid: "u1", displayName: "Alex", ... }` with `auth.token.email_verified = false` -> `PERMISSION_DENIED`.
2. **Shadow / Ghost Field Injection**: User profile update adding `"isAdmin": true` -> Rejected by `.keys().hasOnly(...)` and `affectedKeys().hasOnly(...)` -> `PERMISSION_DENIED`.
3. **Third-Party Email Subscription**: Viewer `u1` (`a@gmail.com`) writes `/subscriptions/room1_u1` with `subscriberEmail: "victim@gmail.com"` -> Rejected by `data.subscriberEmail == request.auth.token.email` -> `PERMISSION_DENIED`.
4. **Cross-User Subscription Read (PII Leak)**: Viewer `u2` calls `get(/subscriptions/room1_u1)` where `hostUid != u2` -> Rejected by owner/host PII check -> `PERMISSION_DENIED`.
5. **Blanket Subscription / Custom Scene Scraping**: Attacker runs `getDocs(collection(db, 'customScenes'))` without filtering `ownerUid == auth.uid` -> Rejected by rule-enforced `allow list` -> `PERMISSION_DENIED`.
6. **ID Poisoning / 2KB Path Variable**: Creating `/customScenes/<200-char-junk>` -> Rejected by `isValidId()` -> `PERMISSION_DENIED`.
7. **Denial-of-Wallet Oversized String**: Updating `displayName` with 5,000 characters or `name` in `/customScenes` > 36 chars -> Rejected by `.size() <= max` -> `PERMISSION_DENIED`.
8. **Value Poisoning on Update**: Updating allowed key `active` in `/subscriptions/{id}` with string `"yes"` instead of `bool` -> Rejected because `isValidStreamSubscription(incoming(), subscriptionId)` wraps `allow update` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating a `ScheduledStream` or `CustomScene` with `createdAt` set 10 days in the past -> Rejected by `incoming().createdAt == request.time` -> `PERMISSION_DENIED`.
10. **Immutable Ownership Hijack**: Updating `ownerUid` on `/customScenes/{sceneId}` to another UID -> Rejected by `incoming().ownerUid == existing().ownerUid` and `affectedKeys().hasOnly(...)` -> `PERMISSION_DENIED`.
11. **Unbounded Array / JSON String Exhaustion**: Creating `/customScenes/{sceneId}` with 50 elements or non-map elements -> Rejected by `elements is list && elements.size() >= 1 && elements.size() <= 12 && elements[0] is map` -> `PERMISSION_DENIED`.
12. **Invalid Enum Injection**: Creating `/customScenes/{sceneId}` with `backdrop: "hacked"` -> Rejected by `data.backdrop in ['dusk', 'graphite', 'ember', 'forest', 'paper']` -> `PERMISSION_DENIED`.
