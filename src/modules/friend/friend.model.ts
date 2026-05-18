import { prisma } from '../../config/prisma.js';
import type { Friend, FriendStatus as DbFriendStatus } from '@prisma/client';

/**
 * Relationship as the frontend sees it (mirrors friends.dto.ts FriendStatus
 * on the client 1:1). Direction-aware: "requested" = I asked them,
 * "incoming" = they asked me.
 */
export type RelStatus = 'none' | 'requested' | 'incoming' | 'friends';

/** A person in a friend list — PublicUser shape + avatar from Profile. */
export interface FriendPerson {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  avatarUrl: string;
}

const PERSON_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  profile: { select: { avatarUrl: true } },
} as const;

type PersonRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  profile: { avatarUrl: string } | null;
};

function toPerson(u: PersonRow): FriendPerson {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    avatarUrl: u.profile?.avatarUrl ?? '',
  };
}

/** Derive the viewer-relative status from a stored row (or its absence). */
export function relStatusOf(viewerId: string, row: Friend | null): RelStatus {
  if (!row) return 'none';
  if (row.status === 'ACCEPTED') return 'friends';
  // PENDING — direction decides.
  return row.requesterId === viewerId ? 'requested' : 'incoming';
}

/**
 * Prisma-backed access for the single Friend row between two users.
 * The row is canonical regardless of who is `requester` — every read uses
 * the unordered-pair predicate so (A,B) and (B,A) resolve to the same row.
 */
export const friendStore = {
  /** The one row between a and b, whichever direction it was created. */
  findPair(a: string, b: string): Promise<Friend | null> {
    return prisma.friend.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  },

  create(requesterId: string, addresseeId: string): Promise<Friend> {
    return prisma.friend.create({ data: { requesterId, addresseeId } });
  },

  accept(requesterId: string, addresseeId: string): Promise<Friend> {
    return prisma.friend.update({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      data: { status: 'ACCEPTED' },
    });
  },

  /** Remove the row by its exact (requester, addressee) ordering. */
  async deleteExact(requesterId: string, addresseeId: string): Promise<void> {
    await prisma.friend.delete({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
    });
  },

  /** ACCEPTED rows touching `userId` on either side → the friend people. */
  async listFriends(userId: string): Promise<FriendPerson[]> {
    const rows = await prisma.friend.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requester: { select: PERSON_SELECT },
        addressee: { select: PERSON_SELECT },
      },
      orderBy: { updatedAt: 'desc' },
    });
    // The friend is "the other side" of each row.
    return rows.map((r) =>
      toPerson(r.requester.id === userId ? r.addressee : r.requester),
    );
  },

  /** PENDING rows where `userId` is the addressee → people who asked me. */
  async listIncoming(userId: string): Promise<FriendPerson[]> {
    const rows = await prisma.friend.findMany({
      where: { status: 'PENDING', addresseeId: userId },
      select: { requester: { select: PERSON_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toPerson(r.requester));
  },

  /** PENDING rows where `userId` is the requester → people I asked. */
  async listOutgoing(userId: string): Promise<FriendPerson[]> {
    const rows = await prisma.friend.findMany({
      where: { status: 'PENDING', requesterId: userId },
      select: { addressee: { select: PERSON_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toPerson(r.addressee));
  },
};

export type { DbFriendStatus };
