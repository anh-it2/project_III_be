import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import {
  userStore,
  profileStore,
  toPublicUser,
  type PublicUser,
  type UserRecord,
  type ProfileDto,
  type ProfileFields,
} from './user.model.js';
import type { CreateUserInput, UpdateProfileInput } from './user.validation.js';
import { ApiError } from '../../utils/api-error.js';

const EMPTY_PROFILE_FIELDS: ProfileFields = {
  bio: '',
  location: '',
  work: '',
  education: '',
  relationship: '',
  avatarUrl: '',
  coverUrl: '',
};

/**
 * The findByName/findByEmail pre-checks below close the common case, but a
 * concurrent insert can still land between check and write. The DB unique
 * indexes (User_email_key, User_name_key) are the real guarantee; translate
 * their violation into the same 409 the pre-check would have produced.
 * `meta.target` is either the column names or the index name depending on the
 * connector/version, so substring-match both.
 */
function rethrowUniqueAsConflict(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const target = String(err.meta?.target ?? '');
    if (target.includes('email')) {
      throw ApiError.conflict('Email already registered');
    }
    if (target.includes('name')) {
      throw ApiError.conflict('Username already taken');
    }
    throw ApiError.conflict('Already exists');
  }
  throw err;
}

export const userService = {
  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await userStore.findByEmail(input.email)) {
      throw ApiError.conflict('Email already registered');
    }
    if (await userStore.findByName(input.name)) {
      throw ApiError.conflict('Username already taken');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const user = await userStore.create({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      return toPublicUser(user);
    } catch (err) {
      rethrowUniqueAsConflict(err);
    }
  },

  async getById(id: string): Promise<PublicUser> {
    const user = await userStore.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  },

  async list(): Promise<PublicUser[]> {
    const users = await userStore.list();
    return users.map(toPublicUser);
  },

  /** Used by the auth module — returns the raw record (with hash). */
  getRecordByEmail(email: string): Promise<UserRecord | null> {
    return userStore.findByEmail(email);
  },

  /**
   * The current user's edit-profile view: User.name merged with the Profile
   * row. A user who never saved a profile reads name + empty defaults (no
   * 404 — the edit page must always render a complete form).
   */
  async getMyProfile(userId: string): Promise<ProfileDto> {
    const user = await userStore.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const profile = await profileStore.getByUserId(userId);
    return { name: user.name, ...(profile ?? EMPTY_PROFILE_FIELDS) };
  },

  /**
   * Full-replace the current user's profile (name → User, rest → Profile),
   * atomically. Returns the saved view so the client can reconcile.
   */
  async updateMyProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<ProfileDto> {
    const user = await userStore.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const { name, ...fields } = input;
    if (await userStore.findByName(name, userId)) {
      throw ApiError.conflict('Username already taken');
    }
    try {
      return await profileStore.replaceForUser(userId, name, fields);
    } catch (err) {
      rethrowUniqueAsConflict(err);
    }
  },
};
