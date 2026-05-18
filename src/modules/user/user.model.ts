import { prisma } from '../../config/prisma.js';

/** Stored shape (includes the password hash — never serialize this directly). */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
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
  create(data: Omit<UserRecord, 'id' | 'createdAt'>): Promise<UserRecord> {
    return prisma.user.create({ data });
  },
  findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  },
  findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email } });
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
