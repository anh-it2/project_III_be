import bcrypt from 'bcryptjs';
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

export const userService = {
  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await userStore.findByEmail(input.email)) {
      throw ApiError.conflict('Email already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await userStore.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });
    return toPublicUser(user);
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
    return profileStore.replaceForUser(userId, name, fields);
  },
};
