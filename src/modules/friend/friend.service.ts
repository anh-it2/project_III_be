import { friendStore, relStatusOf } from './friend.model.js';
import type { RelStatus, FriendPerson } from './friend.model.js';
import { userStore } from '../user/user.model.js';
import { ApiError } from '../../utils/api-error.js';

/** Reject self-targeting and unknown users before any write. */
async function assertOtherUser(meId: string, otherId: string): Promise<void> {
  if (meId === otherId) {
    throw ApiError.badRequest('Cannot friend yourself');
  }
  if (!(await userStore.findById(otherId))) {
    throw ApiError.notFound('User not found');
  }
}

export interface FriendsSnapshot {
  friends: FriendPerson[];
  incoming: FriendPerson[];
  outgoing: FriendPerson[];
}

export const friendService = {
  /** Viewer-relative relationship to one user. */
  async getStatus(meId: string, otherId: string): Promise<RelStatus> {
    if (meId === otherId) return 'none';
    const row = await friendStore.findPair(meId, otherId);
    return relStatusOf(meId, row);
  },

  /** Everything the friends page needs in one call. */
  async snapshot(meId: string): Promise<FriendsSnapshot> {
    const [friends, incoming, outgoing] = await Promise.all([
      friendStore.listFriends(meId),
      friendStore.listIncoming(meId),
      friendStore.listOutgoing(meId),
    ]);
    return { friends, incoming, outgoing };
  },

  /** Send a request → a PENDING row (meId = requester). */
  async sendRequest(meId: string, otherId: string): Promise<void> {
    await assertOtherUser(meId, otherId);
    const existing = await friendStore.findPair(meId, otherId);
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw ApiError.conflict('Already friends');
      }
      // A PENDING row exists in some direction.
      if (existing.requesterId === meId) {
        throw ApiError.conflict('Request already sent');
      }
      // They already requested me — accept that instead of stacking a
      // mirror row (keeps the (A,B)/(B,A) single-row invariant).
      await friendStore.accept(existing.requesterId, existing.addresseeId);
      return;
    }
    await friendStore.create(meId, otherId);
  },

  /** Cancel a request I sent → drop my PENDING row. */
  async cancelRequest(meId: string, otherId: string): Promise<void> {
    const row = await friendStore.findPair(meId, otherId);
    if (!row || row.status !== 'PENDING' || row.requesterId !== meId) {
      throw ApiError.notFound('No outgoing request to cancel');
    }
    await friendStore.deleteExact(row.requesterId, row.addresseeId);
  },

  /** Accept an incoming request → flip their PENDING row to ACCEPTED. */
  async acceptRequest(meId: string, otherId: string): Promise<void> {
    const row = await friendStore.findPair(meId, otherId);
    if (!row || row.status !== 'PENDING' || row.addresseeId !== meId) {
      throw ApiError.notFound('No incoming request to accept');
    }
    await friendStore.accept(row.requesterId, row.addresseeId);
  },

  /** Reject an incoming request → delete their PENDING row. */
  async rejectRequest(meId: string, otherId: string): Promise<void> {
    const row = await friendStore.findPair(meId, otherId);
    if (!row || row.status !== 'PENDING' || row.addresseeId !== meId) {
      throw ApiError.notFound('No incoming request to reject');
    }
    await friendStore.deleteExact(row.requesterId, row.addresseeId);
  },

  /** Remove an existing friend → delete the ACCEPTED row (either side). */
  async unfriend(meId: string, otherId: string): Promise<void> {
    const row = await friendStore.findPair(meId, otherId);
    if (!row || row.status !== 'ACCEPTED') {
      throw ApiError.notFound('Not friends');
    }
    await friendStore.deleteExact(row.requesterId, row.addresseeId);
  },
};
