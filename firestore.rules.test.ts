/**
 * Phase 0 Dirty Dozen Security Specification Validator
 * Mirrors the invariants enforced by /firestore.rules for UserProfile,
 * StreamSubscription, and ScheduledStream.
 */

export interface MockAuthContext {
  uid: string;
  email: string;
  email_verified: boolean;
}

const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && SLUG_RE.test(id);
}

export function evaluateDirtyDozenCase(
  auth: MockAuthContext | null,
  collection: 'users' | 'subscriptions' | 'scheduledShows' | 'customScenes',
  docId: string,
  op: 'get' | 'list' | 'create' | 'update',
  payload?: Record<string, unknown>,
  existingDoc?: Record<string, unknown>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (op !== 'list' && !isValidId(docId)) return 'PERMISSION_DENIED';

  if (collection === 'users') {
    if (op === 'list') return 'PERMISSION_DENIED';
    if (auth.uid !== docId) return 'PERMISSION_DENIED';
    if (op === 'get') return 'ALLOW';
    if (!payload) return 'PERMISSION_DENIED';
    const allowed = new Set([
      'uid',
      'displayName',
      'email',
      'photoURL',
      'paypalHandle',
      'venmoHandle',
      'cashappTag',
      'stripeUrl',
      'createdAt',
      'updatedAt',
    ]);
    for (const k of Object.keys(payload)) {
      if (!allowed.has(k)) return 'PERMISSION_DENIED';
    }
    if (
      payload.uid !== docId ||
      typeof payload.displayName !== 'string' ||
      payload.displayName.length < 1 ||
      payload.displayName.length > 40 ||
      payload.createdAt !== 'SERVER_TIME' ||
      payload.updatedAt !== 'SERVER_TIME'
    ) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'subscriptions') {
    if (op === 'list') {
      if (!existingDoc) return 'PERMISSION_DENIED';
      return existingDoc.subscriberUid === auth.uid || existingDoc.hostUid === auth.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'get') {
      if (!existingDoc) {
        return docId.endsWith(`_${auth.uid}`) && docId.length > auth.uid.length + 1
          ? 'ALLOW'
          : 'PERMISSION_DENIED';
      }
      return existingDoc.subscriberUid === auth.uid || existingDoc.hostUid === auth.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (!payload) return 'PERMISSION_DENIED';
    const allowed = new Set([
      'subscriptionId',
      'hostKey',
      'hostUid',
      'hostName',
      'subscriberUid',
      'subscriberEmail',
      'subscriberName',
      'active',
      'createdAt',
      'updatedAt',
    ]);
    for (const k of Object.keys(payload)) {
      if (!allowed.has(k)) return 'PERMISSION_DENIED';
    }
    if (
      payload.subscriptionId !== docId ||
      payload.subscriberUid !== auth.uid ||
      payload.subscriberEmail !== auth.email ||
      payload.subscriptionId !== `${String(payload.hostKey)}_${String(payload.subscriberUid)}` ||
      typeof payload.active !== 'boolean'
    ) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'scheduledShows') {
    if (op === 'get' || op === 'list') {
      return existingDoc?.hostUid === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (!payload) return 'PERMISSION_DENIED';
    if (
      payload.id !== docId ||
      payload.hostUid !== auth.uid ||
      !['standard', 'shop', 'gamer'].includes(String(payload.watchMode)) ||
      payload.createdAt !== 'SERVER_TIME' ||
      payload.updatedAt !== 'SERVER_TIME'
    ) {
      return 'PERMISSION_DENIED';
    }
    if (op === 'update' && existingDoc && payload.hostUid !== existingDoc.hostUid) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'customScenes') {
    if (op === 'get' || op === 'list') {
      return existingDoc?.ownerUid === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (!payload) return 'PERMISSION_DENIED';
    const allowed = new Set([
      'id',
      'ownerUid',
      'name',
      'aspect',
      'baseTemplateId',
      'elements',
      'backdrop',
      'bannerTitle',
      'bannerSubtitle',
      'bannerStyle',
      'bannerVisible',
      'createdAt',
      'updatedAt',
    ]);
    for (const k of Object.keys(payload)) {
      if (!allowed.has(k)) return 'PERMISSION_DENIED';
    }
    if (
      payload.id !== docId ||
      payload.ownerUid !== auth.uid ||
      typeof payload.name !== 'string' ||
      payload.name.length < 1 ||
      payload.name.length > 36 ||
      !['16:9', '9:16'].includes(String(payload.aspect)) ||
      !Array.isArray(payload.elements) ||
      payload.elements.length < 1 ||
      payload.elements.length > 12 ||
      typeof payload.elements[0] !== 'object' ||
      payload.elements[0] === null ||
      !['dusk', 'graphite', 'ember', 'forest', 'paper'].includes(String(payload.backdrop)) ||
      !['editorial', 'broadcast', 'glass', 'minimal', 'block'].includes(String(payload.bannerStyle)) ||
      typeof payload.bannerVisible !== 'boolean' ||
      payload.createdAt !== 'SERVER_TIME' ||
      payload.updatedAt !== 'SERVER_TIME'
    ) {
      return 'PERMISSION_DENIED';
    }
    if (op === 'update' && existingDoc && payload.ownerUid !== existingDoc.ownerUid) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

export function runDirtyDozenAssertions(): boolean {
  const u1: MockAuthContext = { uid: 'user_1', email: 'u1@gmail.com', email_verified: true };
  const u2: MockAuthContext = { uid: 'user_2', email: 'u2@gmail.com', email_verified: true };
  const unverified: MockAuthContext = { uid: 'user_1', email: 'u1@gmail.com', email_verified: false };

  const results = [
    // 1. Unverified email spoof
    evaluateDirtyDozenCase(unverified, 'users', 'user_1', 'create', {
      uid: 'user_1',
      displayName: 'Alex',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 2. Shadow / ghost field
    evaluateDirtyDozenCase(u1, 'users', 'user_1', 'create', {
      uid: 'user_1',
      displayName: 'Alex',
      isAdmin: true,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 3. Third-party email subscription
    evaluateDirtyDozenCase(u1, 'subscriptions', 'shop01_user_1', 'create', {
      subscriptionId: 'shop01_user_1',
      hostKey: 'shop01',
      hostName: 'Maya',
      subscriberUid: 'user_1',
      subscriberEmail: 'victim@gmail.com',
      subscriberName: 'Alex',
      active: true,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 4. Cross-user PII subscription read
    evaluateDirtyDozenCase(u2, 'subscriptions', 'shop01_user_1', 'get', undefined, {
      subscriberUid: 'user_1',
      hostUid: 'host_99',
    }),
    // 5. Blanket customScenes scraping
    evaluateDirtyDozenCase(u2, 'customScenes', 'scene_1', 'list', undefined, {
      ownerUid: 'user_1',
    }),
    // 6. ID poisoning (200 chars)
    evaluateDirtyDozenCase(u1, 'customScenes', 'x'.repeat(200), 'get'),
    // 7. Oversized displayName
    evaluateDirtyDozenCase(u1, 'users', 'user_1', 'create', {
      uid: 'user_1',
      displayName: 'A'.repeat(200),
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 8. Value poisoning on active boolean
    evaluateDirtyDozenCase(u1, 'subscriptions', 'shop01_user_1', 'update', {
      subscriptionId: 'shop01_user_1',
      hostKey: 'shop01',
      hostName: 'Maya',
      subscriberUid: 'user_1',
      subscriberEmail: 'u1@gmail.com',
      subscriberName: 'Alex',
      active: 'yes',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 9. Client timestamp forgery
    evaluateDirtyDozenCase(u1, 'scheduledShows', 'show_1', 'create', {
      id: 'show_1',
      hostUid: 'user_1',
      hostKey: 'shop01',
      hostName: 'Maya',
      title: 'Live Drop',
      scheduledIso: '2026-12-01T18:00:00Z',
      roomCode: 'SHOP01',
      watchMode: 'shop',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: 'SERVER_TIME',
    }),
    // 10. Immutable ownership hijack on customScenes
    evaluateDirtyDozenCase(
      u1,
      'customScenes',
      'scene_1',
      'update',
      {
        id: 'scene_1',
        ownerUid: 'user_2',
        name: 'Podcast Split',
        aspect: '16:9',
        baseTemplateId: 'duo',
        elements: [{ id: 'b1', kind: 'participant', label: 'Host', x: 0, y: 0, w: 0.5, h: 1 }],
        backdrop: 'dusk',
        bannerTitle: 'Live',
        bannerSubtitle: 'Q&A',
        bannerStyle: 'glass',
        bannerVisible: true,
        createdAt: 'SERVER_TIME',
        updatedAt: 'SERVER_TIME',
      },
      { ownerUid: 'user_1' }
    ),
    // 11. Unbounded array exhaustion on customScenes (20 boxes > 12 max)
    evaluateDirtyDozenCase(u1, 'customScenes', 'scene_1', 'create', {
      id: 'scene_1',
      ownerUid: 'user_1',
      name: 'Overloaded',
      aspect: '16:9',
      baseTemplateId: 'custom',
      elements: Array.from({ length: 20 }, (_, i) => ({ id: `b${i}` })),
      backdrop: 'dusk',
      bannerTitle: 'Live',
      bannerSubtitle: 'Q&A',
      bannerStyle: 'glass',
      bannerVisible: true,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
    // 12. Invalid backdrop enum on customScenes
    evaluateDirtyDozenCase(u1, 'customScenes', 'scene_1', 'create', {
      id: 'scene_1',
      ownerUid: 'user_1',
      name: 'Invalid Backdrop',
      aspect: '16:9',
      baseTemplateId: 'duo',
      elements: [{ id: 'b1', kind: 'participant', label: 'Host', x: 0, y: 0, w: 0.5, h: 1 }],
      backdrop: 'hacked',
      bannerTitle: 'Live',
      bannerSubtitle: 'Q&A',
      bannerStyle: 'glass',
      bannerVisible: true,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    }),
  ];

  return results.every((r) => r === 'PERMISSION_DENIED');
}
