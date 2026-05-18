# Adding PostgreSQL (beginner step-by-step)

Right now the app stores users in memory (`src/modules/user/user.model.ts`) — a
JavaScript `Map`. Everything is lost when the server restarts. This guide swaps
that for a real **PostgreSQL** database using **Prisma** (an ORM = a tool that
turns DB rows into typed JS objects and writes the SQL for you).

You do **not** need to know SQL to follow this. Do the steps in order.

---

## What you will end up with

```
DATABASE_URL  ──>  PostgreSQL server (runs in Docker)
                        ▲
                        │ Prisma (typed queries + migrations)
                        │
   user.service.ts ──> user.model.ts  (Prisma instead of Map)
```

Nothing in `controller` / `routes` changes. Only the model + service files.

---

## Step 1 — Run a PostgreSQL server with Docker

**Why Docker:** installing Postgres natively is fiddly and differs per OS.
Docker runs Postgres in an isolated "container" with one command, and you can
delete it cleanly later.

### 1a. Install Docker Desktop

- Download: https://www.docker.com/products/docker-desktop/
- Install, open it, wait until the whale icon says **"Docker Desktop is running"**.
- Verify in a terminal:

```bash
docker --version
```

You should see something like `Docker version 27.x`.

### 1b. Add a compose file

Create a new file `docker-compose.yml` in the project root
(`social-platform-be/docker-compose.yml`) with exactly this:

```yaml
services:
  db:
    image: postgres:16
    container_name: spbe-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: spbe
      POSTGRES_PASSWORD: spbe_password
      POSTGRES_DB: spbe
    ports:
      - "5432:5432"
    volumes:
      - spbe_pgdata:/var/lib/postgresql/data

volumes:
  spbe_pgdata:
```

What this says: run Postgres 16, create a user `spbe` with password
`spbe_password` and a database named `spbe`, expose it on port `5432`, and keep
the data in a named volume so it survives container restarts.

### 1c. Start it

```bash
cd social-platform-be
docker compose up -d
```

`-d` = run in background. Check it is healthy:

```bash
docker compose ps
```

Status should be `running`. (To stop later: `docker compose down`. To wipe all
data too: `docker compose down -v`.)

> No Docker allowed? Alternative: install Postgres natively from
> https://www.postgresql.org/download/ , then create a database and user
> manually with `createdb` / `createuser`. Docker is strongly recommended for a
> beginner — skip this note if you used Docker.

---

## Step 2 — Set the connection string

Open `.env` (copy from `.env.example` if you have not yet: `cp .env.example .env`)
and add this line:

```
DATABASE_URL="postgresql://spbe:spbe_password@localhost:5432/spbe?schema=public"
```

Format is `postgresql://<user>:<password>@<host>:<port>/<database>`. The values
match the `docker-compose.yml` above.

Also add `DATABASE_URL` to `.env.example` (without the real password is fine for
the example file) so teammates know it is required.

---

## Step 3 — Install Prisma

```bash
cd social-platform-be
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider postgresql
```

`prisma init` creates a `prisma/` folder with a `schema.prisma` file and may add
a `DATABASE_URL` placeholder to `.env` — if it added a second `DATABASE_URL`,
delete the placeholder and keep yours from Step 2.

---

## Step 4 — Describe the User table

Open `prisma/schema.prisma`. Replace its contents with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

This is the same shape as the current `UserRecord` interface. `@unique` on
`email` makes the database itself reject duplicate emails.

---

## Step 5 — Create the table (migration)

A *migration* = a versioned SQL script Prisma generates from your schema and runs
against the DB.

```bash
npx prisma migrate dev --name init
```

This connects to Postgres, creates the `User` table, and generates the typed
Prisma client. Run this **every time you change `schema.prisma`** (with a new
`--name`).

Optional sanity check — open a visual DB browser:

```bash
npx prisma studio
```

---

## Step 6 — Create one shared Prisma client

Create `src/config/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client';

// One client for the whole app. Creating many leaks DB connections.
export const prisma = new PrismaClient();
```

---

## Step 7 — Swap the in-memory store for Prisma

Replace the **entire** contents of `src/modules/user/user.model.ts` with:

```ts
import { prisma } from '../../config/prisma.js';

// Prisma generates this type, but we keep our own names to avoid changing
// the rest of the codebase.
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash, ...pub } = user;
  return pub;
}

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
```

Key change: every method is now **async** (returns a `Promise`), because talking
to a database takes time. `createdAt` is now a `Date` (Prisma returns Date
objects), not a string.

---

## Step 8 — Make the service await the store

Open `src/modules/user/user.service.ts` and add `await` in front of every
`userStore.*` call, and make the methods that did not already return a Promise
`async`. Final version:

```ts
import bcrypt from 'bcryptjs';
import { userStore, toPublicUser, type PublicUser, type UserRecord } from './user.model.js';
import type { CreateUserInput } from './user.validation.js';
import { ApiError } from '../../utils/api-error.js';

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

  getRecordByEmail(email: string): Promise<UserRecord | null> {
    return userStore.findByEmail(email);
  },
};
```

Then the controller calls that read users must `await` too —
`src/modules/user/user.controller.ts`:

```ts
import type { Request, Response } from 'express';
import { userService } from './user.service.js';

export const userController = {
  async create(req: Request, res: Response) {
    const user = await userService.create(req.body);
    res.status(201).json({ success: true, data: user });
  },

  async list(_req: Request, res: Response) {
    res.json({ success: true, data: await userService.list() });
  },

  async getById(req: Request, res: Response) {
    res.json({ success: true, data: await userService.getById(req.params.id) });
  },

  async me(req: Request, res: Response) {
    res.json({ success: true, data: await userService.getById(req.user!.sub) });
  },
};
```

And in `src/modules/auth/auth.service.ts`, the line
`const record = userService.getRecordByEmail(input.email);` becomes:

```ts
const record = await userService.getRecordByEmail(input.email);
```

(`getRecordByEmail` now returns a Promise, so it must be awaited. The function
is already `async`, so `await` is allowed.)

---

## Step 9 — Close the DB on shutdown

In `src/server.ts`, inside the `shutdown` function, disconnect Prisma before
exiting. Add the import and one line:

```ts
import { prisma } from './config/prisma.js';
// ...
function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
```

---

## Step 10 — Test it

```bash
docker compose up -d        # make sure Postgres is running
npm run typecheck           # must be clean
npm run dev                 # starts on http://localhost:8080
```

In another terminal:

```bash
curl -X POST localhost:8080/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}'

curl localhost:8080/api/v1/users
```

Now **restart the server** (Ctrl+C, then `npm run dev` again) and run
`curl localhost:8080/api/v1/users` once more. The user is still there — that
proves the data is persisted in Postgres, not memory.

---

## Cheat sheet

| Command | What it does |
|---|---|
| `docker compose up -d` | start Postgres |
| `docker compose down` | stop Postgres (data kept) |
| `docker compose down -v` | stop + delete all data |
| `npx prisma migrate dev --name <x>` | apply a schema change |
| `npx prisma studio` | browse the DB in a UI |
| `npx prisma generate` | regenerate the typed client |

## Common errors

- **`Can't reach database server at localhost:5432`** — Postgres not running.
  Run `docker compose up -d` and check `docker compose ps`.
- **`Environment variable not found: DATABASE_URL`** — missing/typo'd line in
  `.env`. Re-check Step 2.
- **`The table 'public.User' does not exist`** — you skipped the migration.
  Run `npx prisma migrate dev --name init`.
- **Port 5432 already in use** — another Postgres is running. Either stop it, or
  change the compose port to `"5433:5432"` and update `DATABASE_URL` to `5433`.
