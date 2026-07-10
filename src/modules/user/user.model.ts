import { prisma } from '../../config/prisma.js';
import type { Role } from '@prisma/client';

/** Stored shape (includes the password hash — never serialize this directly). */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

/** Safe shape returned to clients. */
export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, ...pub } = user;
  return pub;
}

/** The Profile columns (everything editable except `name`, which is on User). */
export interface ProfileFields {
  bio: string;
  location: string;
  work: string;
  education: string;
  relationship: string;
  avatarUrl: string;
  coverUrl: string;
}

/** Wire shape for the edit-profile page: User.name merged with ProfileFields. */
export interface ProfileDto extends ProfileFields {
  name: string;
}

const PROFILE_SELECT = {
  bio: true,
  location: true,
  work: true,
  education: true,
  relationship: true,
  avatarUrl: true,
  coverUrl: true,
} as const;

/**
 * Postgres-backed store via Prisma. Every method is async — talking to a
 * database takes time. Controllers/services must `await` these.
 */
export const userStore = {
  // role omitted from the input: new users default to USER (schema @default).
  // An admin is promoted out-of-band (DB update), never at registration.
  create(data: Omit<UserRecord, 'id' | 'createdAt' | 'role'>): Promise<UserRecord> {
    return prisma.user.create({ data });
  },
  findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  },
  findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email } });
  },
  /**
   * Name has no DB unique constraint, so this is a findFirst, not findUnique.
   * `exceptId` lets edit-profile ignore the caller's own row (re-saving the
   * same name must not collide with itself).
   */
  findByName(name: string, exceptId?: string): Promise<UserRecord | null> {
    return prisma.user.findFirst({
      where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
  },
  list(): Promise<UserRecord[]> {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  },
};

/**
 * Profile data access. `getByUserId` returns null when the user never saved
 * a profile (caller substitutes empty defaults). `replaceForUser` writes
 * User.name and the Profile row atomically — a half-applied edit (name saved
 * but bio lost, or vice-versa) must never be observable.
 */
export const profileStore = {
  getByUserId(userId: string): Promise<ProfileFields | null> {
    return prisma.profile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    });
  },

  /**
   * Set a single image column (avatarUrl/coverUrl) without touching the rest
   * of the profile. Upsert because a user who never saved a profile has no
   * Profile row yet — the other columns fall back to their schema defaults.
   */
  async setImage(
    userId: string,
    field: 'avatarUrl' | 'coverUrl',
    url: string,
  ): Promise<void> {
    const data = { [field]: url };
    await prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },

  async replaceForUser(
    userId: string,
    name: string,
    fields: ProfileFields,
  ): Promise<ProfileDto> {
    const [, profile] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name } }),
      prisma.profile.upsert({
        where: { userId },
        create: { userId, ...fields },
        update: fields,
        select: PROFILE_SELECT,
      }),
    ]);
    return { name, ...profile };
  },
};
