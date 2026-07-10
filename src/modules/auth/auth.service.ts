import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { userService } from '../user/user.service.js';
import { toPublicUser, type PublicUser } from '../user/user.model.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';

import type { Role } from '@prisma/client';

function issueToken(user: { id: string; email: string; role: Role }): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as SignOptions,
  );
}

export const authService = {
  async login(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
    const record = await userService.getRecordByEmail(input.email);
    if (!record) throw ApiError.unauthorized('Invalid credentials');

    const ok = await bcrypt.compare(input.password, record.passwordHash);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');

    return { token: issueToken(record), user: toPublicUser(record) };
  },

  async register(input: RegisterInput): Promise<{ token: string; user: PublicUser }> {
    // userService.create hashes the password and rejects duplicate emails.
    const user = await userService.create(input);
    return { token: issueToken(user), user };
  },
};
