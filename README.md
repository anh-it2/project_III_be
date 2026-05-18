# social-platform-be

Express.js + TypeScript (ESM) backend using **feature-based architecture**.

## Architecture

Code is grouped by *feature*, not by technical layer. Each module under
`src/modules/<feature>/` is self-contained: routes → controller → service → model,
plus validation. Shared concerns live outside modules.

```
src/
├── config/                 # env loading & typed config
│   └── env.ts
├── middleware/             # cross-cutting middleware
│   ├── auth.middleware.ts      # Bearer/JWT guard (requireAuth)
│   ├── error.middleware.ts     # 404 + central error handler
│   └── validate.middleware.ts  # zod body validation
├── utils/
│   ├── api-error.ts        # ApiError (typed HTTP errors)
│   └── catch-async.ts      # async handler wrapper
├── modules/
│   ├── user/
│   │   ├── user.routes.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.model.ts        # in-memory store (swap for a real DB)
│   │   └── user.validation.ts
│   └── auth/
│       ├── auth.routes.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       └── auth.validation.ts
├── routes/index.ts         # mounts every feature module
├── app.ts                  # express app assembly
└── server.ts               # http listener + graceful shutdown
```

**Layer rules:** routes wire HTTP → controller handles req/res only →
service holds business logic → model handles persistence. Controllers never
touch the store directly.

## Setup

```bash
cd social-platform-be
npm install
cp .env.example .env
npm run dev          # tsx watch, http://localhost:8080
```

Scripts: `dev` (watch), `start` (run), `build` / `typecheck` (tsc --noEmit).

## API

Base URL: `http://localhost:8080/api/v1`

| Method | Path             | Auth   | Body                       |
|--------|------------------|--------|----------------------------|
| GET    | `/health`        | –      | –                          |
| POST   | `/users`         | –      | `{ name, email, password }`|
| GET    | `/users`         | –      | –                          |
| GET    | `/users/me`      | Bearer | –                          |
| GET    | `/users/:id`     | –      | –                          |
| POST   | `/auth/login`    | –      | `{ email, password }`      |

### Quick test

```bash
curl -X POST localhost:8080/api/v1/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}'

curl -X POST localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"password123"}'

curl localhost:8080/api/v1/users/me -H 'Authorization: Bearer <token>'
```

## Adding a feature

1. `mkdir src/modules/<feature>`
2. Add `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.validation.ts` (and `*.model.ts` if it owns data).
3. Register it in `src/routes/index.ts`.

Nothing else changes — that is the point of feature-based structure.

## Going to production

- Replace `user.model.ts`'s in-memory `Map` with a real DB (Prisma / Drizzle / Mongoose). Service/controller layers stay untouched.
- Add a real secret manager for `JWT_SECRET`.
- Add structured logging (pino) + tests (vitest/supertest).
