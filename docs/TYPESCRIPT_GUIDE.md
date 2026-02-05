# TypeScript Guide for Node-Social

A practical TypeScript guide written for this codebase. Every example uses real code from
this project. No abstract `Foo<Bar>` nonsense -- just patterns you can copy-paste into your
files right now.

---

## Table of Contents

- [Part 1: TypeScript Fundamentals](#part-1-typescript-fundamentals)
  - [Types vs Interfaces](#types-vs-interfaces)
  - [Generics](#generics)
  - [Union Types and Discriminated Unions](#union-types-and-discriminated-unions)
  - [Type Narrowing](#type-narrowing)
  - [unknown vs any](#unknown-vs-any)
  - [Optional Chaining and Nullish Coalescing](#optional-chaining-and-nullish-coalescing)
  - [Type Assertions vs Type Guards](#type-assertions-vs-type-guards)
- [Part 2: Fixing Every `any` in Your Codebase](#part-2-fixing-every-any-in-your-codebase)
  - [Backend: index.ts](#backend-indexts)
  - [Backend: auth.ts (routes)](#backend-authts-routes)
  - [Backend: posts.ts](#backend-poststs)
  - [Backend: comments.ts](#backend-commentsts)
  - [Backend: reactions.ts](#backend-reactionsts)
  - [Backend: vibeService.ts](#backend-vibeservicets)
  - [Backend: moderation.ts (routes)](#backend-moderationts-routes)
  - [Backend: moderation.ts (lib)](#backend-moderationts-lib)
  - [Frontend: App.tsx](#frontend-apptsx)
  - [Frontend: api.ts](#frontend-apits)
  - [Frontend: Sidebar.tsx](#frontend-sidebartsx)
  - [Frontend: VibeValidator.tsx](#frontend-vibevalidatortsx)
  - [Frontend: Feed.tsx](#frontend-feedtsx)
  - [Frontend: CreatePostModal.tsx](#frontend-createpostmodaltsx)
  - [Frontend: LoginScreen.tsx](#frontend-loginscreentsx)
  - [Frontend: Error Catches Across All Screens](#frontend-error-catches-across-all-screens)
- [Part 3: Patterns for Your Stack](#part-3-patterns-for-your-stack)
  - [Prisma + TypeScript](#prisma--typescript)
  - [Zod + TypeScript](#zod--typescript)
  - [Fastify + TypeScript](#fastify--typescript)
  - [React + TypeScript](#react--typescript)
  - [Zustand + TypeScript](#zustand--typescript)
- [Part 4: Quick Reference Cheat Sheet](#part-4-quick-reference-cheat-sheet)
  - [Common Patterns](#common-patterns)
  - [Instead of X, Do Y](#instead-of-x-do-y)
  - [Reading TypeScript Error Messages](#reading-typescript-error-messages)

---

## Part 1: TypeScript Fundamentals

### Types vs Interfaces

Both create named shapes for data. The practical difference is small, so here is a simple
rule for this codebase.

**Use `interface` for objects that describe a "thing" -- a noun.**

```ts
// A user, a post, a comment -- these are things
interface UIAuthor {
  username: string;
  avatar: string;
  era: string;
  connoisseurCred: number;
}
```

**Use `type` for everything else: unions, intersections, utility types, function signatures.**

```ts
// A union of string literals
type ModAction = 'delete' | 'hide' | 'warn' | 'ban';

// A type extracted from another type
type User = AuthResponse['user'];

// A function signature
type OnNodeSelect = (nodeId: string | null) => void;
```

Both work in almost all the same places. Pick one per situation and stay consistent.

**When they differ.** Interfaces can be extended by other files using declaration merging --
that is exactly what the Fastify plugin system uses:

```ts
// This is declaration merging. Only interfaces can do this.
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
```

You already use this pattern in `plugins/prisma.ts`, `plugins/redis.ts`, and
`plugins/meilisearch.ts`. That is the textbook correct use of interfaces.

### Generics

Generics let you write code that works with different types without losing type information.
You already use them -- you just might not have realized you were choosing types.

**You already use generics every time you call `useState`:**

```ts
// This is a generic -- you are telling useState what type it holds
const [posts, setPosts] = useState<Post[]>([]);
//                                 ^^^^^^ this is the generic argument
```

**And every time you call your `request` function in `api.ts`:**

```ts
// You wrote this! The <T> is a generic type parameter.
async function request<T>(path: string, options: RequestInit): Promise<T> {
  // ...
  return res.json() as Promise<T>;
}

// When you call it, you pass the type:
request<AuthResponse>('/auth/login', { method: 'POST', body: '...' });
//      ^^^^^^^^^^^^^ T becomes AuthResponse, so the return type is Promise<AuthResponse>
```

**The way to read generics:** Think of `<T>` as a function parameter, but for types. Just
like a function takes a value and gives back a value, a generic takes a type and gives back
a type.

```ts
// Regular function: takes a number, gives back a number
function double(n: number): number { return n * 2; }

// Generic function: takes a TYPE, gives back a Promise of that TYPE
function request<T>(path: string): Promise<T> { /* ... */ }
```

**Prisma uses generics extensively:**

```ts
// Prisma.PostGetPayload takes a type argument describing what you included
type PostWithCounts = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;
// Now PostWithCounts knows about author, node, metrics, _count, etc.
```

**Zod uses generics through `z.infer`:**

```ts
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// z.infer extracts the TypeScript type from the Zod schema
type RegisterInput = z.infer<typeof registerSchema>;
// RegisterInput = { email: string; password: string }
```

### Union Types and Discriminated Unions

A union type says "this value can be one of these types."

**Simple unions you already use:**

```ts
// This value is either a string or null
const nodeId: string | null = null;

// This is a union of string literals -- only these exact strings are allowed
type ModAction = 'delete' | 'hide' | 'warn' | 'ban';
type ModTargetType = 'post' | 'comment' | 'user';
```

**Discriminated unions -- the most useful pattern you are not using yet.**

A discriminated union is a union where each member has a shared field (the "discriminant")
that tells you which variant it is. The Google OAuth response you handle in `LoginScreen.tsx`
is a perfect example of where this helps:

```ts
// The response from Google OAuth is a discriminated union.
// The "type" field tells you which variant you have.
type GoogleResponse =
  | { type: 'success'; params: Record<string, string>; authentication?: { idToken: string } }
  | { type: 'error'; error: { message: string; error_description?: string } }
  | { type: 'dismiss' }
  | { type: 'cancel' };

// Once you check the type field, TypeScript knows which variant you have:
if (googleResponse.type === 'success') {
  // TypeScript knows googleResponse.params exists here
  const token = googleResponse.params.id_token;
}
```

**Another practical example -- API responses:**

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function handleResult(result: ApiResult<Post[]>) {
  if (result.ok) {
    // TypeScript knows result.data exists and is Post[]
    console.log(result.data.length);
  } else {
    // TypeScript knows result.error exists and is string
    console.error(result.error);
  }
}
```

### Type Narrowing

Type narrowing is how TypeScript figures out a more specific type from a broader one. You
already do this all the time -- you just did not know the name.

**`typeof` narrowing -- for primitives:**

```ts
function formatValue(value: string | number) {
  if (typeof value === 'string') {
    // TypeScript knows value is string here
    return value.toUpperCase();
  }
  // TypeScript knows value is number here
  return value.toFixed(2);
}
```

**Truthiness narrowing -- you do this constantly:**

```ts
// From your posts.ts route:
const post = await fastify.prisma.post.findUnique({ where: { id } });

if (!post) {
  // TypeScript knows post is null/undefined here
  return reply.status(404).send({ error: 'Post not found' });
}
// TypeScript knows post is a Post object from here on
```

**`in` operator narrowing -- checking if a property exists:**

```ts
function handleResponse(body: { error: string } | { data: Post[] }) {
  if ('error' in body) {
    // TypeScript knows body has an error property
    console.log(body.error);
  } else {
    // TypeScript knows body has a data property
    console.log(body.data);
  }
}
```

**`instanceof` narrowing -- for class instances:**

```ts
try {
  await someOperation();
} catch (error) {
  if (error instanceof Error) {
    // TypeScript knows error.message exists
    console.log(error.message);
  }
}
```

### unknown vs any

This is the single most important concept for cleaning up your codebase.

**`any` means "turn off TypeScript for this value."** The compiler will not check anything
you do with it. You can call `.foo.bar.baz()` on it and TypeScript will not complain --
it will just crash at runtime.

**`unknown` means "I do not know what this is yet, but I will check before I use it."**
TypeScript forces you to narrow the type before you can do anything with it.

```ts
// With any -- compiles fine, crashes at runtime
function bad(value: any) {
  return value.foo.bar.baz(); // No error. Will crash if value is null.
}

// With unknown -- forces you to check first
function good(value: unknown) {
  // return value.foo; // ERROR: Object is of type 'unknown'

  // You must narrow first:
  if (typeof value === 'object' && value !== null && 'foo' in value) {
    return (value as { foo: string }).foo; // Now it is safe
  }
}
```

**Practical rule for your codebase:** Use `unknown` everywhere you currently use `any` for
error catches. Instead of `catch (error: any)`, use `catch (error: unknown)` and narrow.

```ts
// BEFORE (your current pattern):
} catch (error: any) {
  fastify.log.error({ error, stack: error.stack }, 'Registration failed');
}

// AFTER:
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  fastify.log.error({ error, stack }, 'Registration failed');
}
```

### Optional Chaining and Nullish Coalescing

You already use these well. Here is a quick refresher on the difference between the
operators.

**Optional chaining `?.` -- short-circuits to `undefined` if left side is null/undefined:**

```ts
// You use this in App.tsx:
p.comments?.map(...)  // If p.comments is undefined, evaluates to undefined

// And in auth.ts:
request.cookies?.accessToken  // If cookies is undefined, evaluates to undefined
```

**Nullish coalescing `??` -- provides a default when left side is null or undefined:**

```ts
// You use this in posts.ts:
post.metrics?.engagementScore ?? 0
// If engagementScore is null or undefined, use 0
// IMPORTANT: ?? only triggers on null/undefined, NOT on 0, false, or ""

// Compare with ||
post.metrics?.engagementScore || 0
// || triggers on ANY falsy value, including 0
// So if engagementScore is 0, || would replace it with 0 (same result by coincidence)
// But if you had a field where 0 is a meaningful value, || would incorrectly replace it
```

**When to use which:**
- `??` when 0, false, or empty string are valid values (scores, counts, booleans)
- `||` when you want to treat all falsy values as "missing" (display strings)

### Type Assertions vs Type Guards

A **type assertion** (`as`) tells the compiler "trust me, I know what this is."
A **type guard** actually checks at runtime.

**Type assertion -- what you are doing now (risky):**

```ts
// You do this in every route handler:
const userId = (request.user as { sub: string }).sub;
// If request.user is undefined, this crashes. The compiler cannot help you.
```

**Type guard -- what you should do instead (safe):**

```ts
// A type guard is a function that returns a type predicate
function hasUser(request: FastifyRequest): request is FastifyRequest & {
  user: { sub: string; email: string }
} {
  return (
    request.user !== null &&
    request.user !== undefined &&
    typeof (request.user as Record<string, unknown>).sub === 'string'
  );
}

// Usage:
if (!hasUser(request)) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
// After the guard, TypeScript knows request.user.sub exists
const userId = request.user.sub;
```

**When assertions are fine:**
- When you are sure about the type AND the value cannot be null/undefined
- When Prisma's generated types do not match what you know from `include`
- When the assertion is immediately next to the code that guarantees the shape

**When you need a type guard instead:**
- When the value comes from an external source (request bodies, API responses, cookies)
- When the value could be null or undefined
- When crashing would be bad (basically always in request handlers)

For your codebase, the `request.user` assertion pattern should be replaced with Fastify's
proper typing (covered in Part 2 and Part 3).

---

## Part 2: Fixing Every `any` in Your Codebase

This section goes through every file that has `any` and shows you what to replace it with.

### Backend: index.ts

**File:** `backend/api/src/index.ts`

#### The `authenticate` decorator (lines 82-104)

```ts
// CURRENT CODE:
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

app.decorate('authenticate', async function (request: any, reply: any) {
  // ...
});
```

```ts
// FIXED CODE:
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  // ...
});
```

**Why:** `FastifyRequest` and `FastifyReply` are the correct types for Fastify request and
reply objects. They come from the `fastify` package you already import. These types know
about `.jwtVerify()`, `.cookies`, `.status()`, `.send()`, and every other method you use on
them.

**Where the types come from:** The `fastify` package itself, via `import type { FastifyRequest, FastifyReply } from 'fastify'`.

---

### Backend: auth.ts (routes)

**File:** `backend/api/src/routes/auth.ts`

#### `issueSessionCookies` and `clearSessionCookies` (lines 79-91)

```ts
// CURRENT CODE:
const issueSessionCookies = (reply: any, accessToken: string, refreshToken: string) => {
  // ...
};

const clearSessionCookies = (reply: any) => {
  // ...
};
```

```ts
// FIXED CODE:
import type { FastifyReply } from 'fastify';

const issueSessionCookies = (reply: FastifyReply, accessToken: string, refreshToken: string) => {
  const csrfToken = randomBytes(24).toString('hex');
  reply.setCookie('accessToken', accessToken, accessCookieOptions);
  reply.setCookie('refreshToken', refreshToken, refreshCookieOptions);
  reply.setCookie('csrfToken', csrfToken, csrfCookieOptions);
};

const clearSessionCookies = (reply: FastifyReply) => {
  const base = { path: '/', domain: cookieDomain, sameSite: 'lax' as const, secure: isProd };
  reply.clearCookie('accessToken', base);
  reply.clearCookie('refreshToken', base);
  reply.clearCookie('csrfToken', base);
};
```

**Why:** `FastifyReply` knows about `setCookie` and `clearCookie` because you registered the
`@fastify/cookie` plugin. You already `import '@fastify/cookie'` at the top of auth.ts --
that import augments `FastifyReply` with the cookie methods.

**Where the type comes from:** `fastify` package, augmented by `@fastify/cookie`.

#### The `catch (error: any)` pattern (lines 267, 468, 510, 704, 746)

This pattern appears five times in auth.ts:

```ts
// CURRENT CODE:
} catch (error: any) {
  if (error?.statusCode === 409) {
    throw error;
  }
  fastify.log.error({ error, errorCode: error?.code, errorMessage: error?.message }, 'Google sign-in failed');
  if (error?.code === 'P2002') {
    // Prisma unique constraint violation
  }
}
```

```ts
// FIXED CODE:
} catch (error: unknown) {
  // Re-throw Fastify errors with statusCode
  if (error instanceof Error && 'statusCode' in error) {
    throw error;
  }

  // Extract error properties safely
  const errorObj = error instanceof Error ? error : null;
  const code = errorObj && 'code' in errorObj ? (errorObj as { code: string }).code : undefined;
  const message = errorObj?.message ?? String(error);

  fastify.log.error({ error, errorCode: code, errorMessage: message }, 'Google sign-in failed');

  if (code === 'P2002') {
    // Prisma unique constraint violation
    return reply.status(409).send({
      error: 'This account is already linked. Please sign in with your original method.'
    });
  }

  return reply.status(400).send({ error: 'Unable to verify credential' });
}
```

**Why:** `catch (error: any)` disables type checking entirely for the error. With `unknown`,
TypeScript forces you to check what the error actually is before accessing properties. This
prevents crashes from unexpected error shapes.

If you find the narrowing verbose, create a small helper:

```ts
// Put this in a shared utility file, e.g., backend/api/src/lib/errors.ts
interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as PrismaError).code === 'string'
  );
}

// Then in your catch blocks:
} catch (error: unknown) {
  if (isPrismaError(error) && error.code === 'P2002') {
    return reply.status(409).send({ error: 'Already linked.' });
  }
  // ...
}
```

#### The `(request.user as { sub: string }).sub` pattern

This appears in `auth.ts` line 874 and in many other files. It is covered in a dedicated
section below since it applies to every route file.

---

### Fixing `request.user as { sub: string }` Everywhere

This pattern appears in almost every route file:
- `auth.ts` line 874 (logout)
- `posts.ts` lines 36, 110, 318
- `comments.ts` lines 33, 138
- `reactions.ts` lines 58, 124, 247, 280
- `nodes.ts` line 30
- `users.ts` lines 9, 53
- `feedPreferences.ts` lines 52, 86
- `moderation.ts` line 75

**The problem:** `request.user` is typed as `unknown` by default in `@fastify/jwt`. You cast
it with `as { sub: string }` every single time. If the JWT payload shape ever changes, every
one of these casts is a silent bug.

**The fix -- declare the JWT payload type once:**

Add this to your `index.ts` (or a dedicated `types.ts` file):

```ts
// Tell @fastify/jwt what shape your JWT payload has
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}
```

Now `request.user` is automatically typed as `{ sub: string; email: string }` in every
route handler. No more casting.

```ts
// BEFORE (in every route handler):
const userId = (request.user as { sub: string }).sub;

// AFTER (in every route handler):
const userId = request.user.sub;  // TypeScript already knows the type
```

**Where the type comes from:** `@fastify/jwt` uses declaration merging (just like your Prisma
and Redis plugins do). When you declare the `FastifyJWT` interface, the JWT plugin picks it up
and uses it for the type of `request.user`.

---

### Backend: posts.ts

**File:** `backend/api/src/routes/posts.ts`

#### `request.params as { id: string }` (lines 273, 317)

```ts
// CURRENT CODE:
const { id } = request.params as { id: string };
```

This one is actually reasonable as type assertions go -- Fastify does not know your route
parameters at the type level unless you use the generic route options. Two approaches:

**Approach A: Keep the assertion (acceptable)**

This is fine if the route path guarantees the param exists. Since your route is `'/:id'`,
the `id` param will always be present. The assertion is safe here.

**Approach B: Use Fastify's route generics (better)**

```ts
fastify.get<{ Params: { id: string } }>(
  '/:id',
  { onRequest: [fastify.authenticate] },
  async (request, reply) => {
    const { id } = request.params; // TypeScript knows id is string
    // ...
  }
);
```

**Why approach B is better:** If you ever rename the param or add more params, TypeScript
catches mismatches at compile time.

#### The `PostWithCounts` cast (line 221)

```ts
// CURRENT CODE:
let posts = (await fastify.prisma.post.findMany(queryArgs)) as PostWithCounts[];
```

This cast exists because `queryArgs` is built dynamically (with the conditional cursor), so
Prisma cannot infer the exact return type. The `PostWithCounts` type you defined on line 215
is correct:

```ts
type PostWithCounts = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;
```

**This cast is acceptable.** You defined the type using `Prisma.PostGetPayload` with the
exact same `include` object, so it accurately describes what Prisma returns. The cast is
needed because TypeScript cannot trace the type through the dynamic `queryArgs` object.

An alternative that avoids the cast entirely:

```ts
// Instead of building queryArgs separately, inline the query:
const posts = await fastify.prisma.post.findMany({
  take: fetchLimit,
  where,
  orderBy: { createdAt: 'desc' },
  include: postInclude,
  ...(cursor ? { cursor: { id: cursor } } : {}),
});
// Now Prisma can infer the return type directly.
// The type of `posts` includes all the included relations.
```

---

### Backend: comments.ts

**File:** `backend/api/src/routes/comments.ts`

#### `request.params as { postId: string }` (lines 20, 85)

Same pattern as posts.ts. Fix with Fastify route generics:

```ts
fastify.post<{ Params: { postId: string } }>(
  '/posts/:postId/comments',
  { onRequest: [fastify.authenticate] },
  async (request, reply) => {
    const { postId } = request.params; // Typed automatically
    // ...
  }
);
```

#### `request.user as { sub: string }` (lines 33, 138)

Fixed by the `@fastify/jwt` declaration merging shown above.

---

### Backend: reactions.ts

**File:** `backend/api/src/routes/reactions.ts`

#### `request.params` casts (lines 56, 122, 172, 236, 268)

Same pattern. Fix with Fastify route generics:

```ts
fastify.post<{ Params: { postId: string } }>(
  '/posts/:postId',
  { onRequest: [fastify.authenticate] },
  async (request, reply) => {
    const { postId } = request.params; // Typed
    // ...
  }
);
```

#### `intensities as VibeIntensities` (lines 88, 154)

```ts
// CURRENT CODE:
intensities: intensities as VibeIntensities,
```

This cast is fine here because `parsed.data.intensities` comes from
`z.record(z.string(), z.number())`, which gives you `Record<string, number>`, and your
`VibeIntensities` is `{ [vectorSlug: string]: number }`. These are structurally identical,
so the cast is actually redundant -- you can remove it:

```ts
// FIXED CODE:
intensities: intensities, // Record<string, number> is compatible with VibeIntensities
```

If TypeScript still complains, it is because the Zod output and your interface have slightly
different index signature styles. The cleanest fix is to use the Zod type directly:

```ts
type VibeIntensities = z.infer<typeof intensitiesSchema>;
// where intensitiesSchema = z.record(z.string(), z.number().min(0).max(1))
```

#### `catch (error: any)` (lines 252, 285)

```ts
// CURRENT CODE:
} catch (error: any) {
  if (error.message === 'Reaction not found') {
    return reply.status(404).send({ error: 'Reaction not found' });
  }
}
```

```ts
// FIXED CODE:
} catch (error: unknown) {
  if (error instanceof Error && error.message === 'Reaction not found') {
    return reply.status(404).send({ error: 'Reaction not found' });
  }
  fastify.log.error({ err: error, postId }, 'Failed to delete reaction');
  return reply.status(500).send({ error: 'Failed to delete reaction' });
}
```

**Why:** `error instanceof Error` narrows the type so `.message` is safe to access. Without
the check, if `error` is somehow not an `Error` object (e.g., a string was thrown), accessing
`.message` returns `undefined` instead of crashing, but only by coincidence. The `instanceof`
check makes the intent explicit.

---

### Backend: vibeService.ts

**File:** `backend/api/src/services/vibeService.ts`

#### `intensities as any` for Prisma Json type (lines 71, 90)

```ts
// CURRENT CODE:
intensities: intensities as any, // Prisma Json type
```

**Why it exists:** Prisma's `Json` type is typed as `Prisma.InputJsonValue`, which is
`string | number | boolean | null | InputJsonObject | InputJsonArray`. Your
`VibeIntensities` (a `Record<string, number>`) satisfies `InputJsonObject`, but TypeScript
sometimes cannot see the compatibility through the index signature.

```ts
// FIXED CODE:
import type { Prisma } from '../../generated/prisma/client.js';

// When creating:
intensities: intensities as Prisma.InputJsonValue,

// When reading (from database):
const intensities = reaction.intensities as VibeIntensities;
```

**Why `as Prisma.InputJsonValue` instead of `as any`:** This tells TypeScript "this is a
valid JSON value for Prisma" without fully disabling type checking. If you accidentally
passed a `Date` object or a function, `as Prisma.InputJsonValue` would still catch it at
compile time. `as any` would not.

Alternatively, create a type-safe helper:

```ts
function toJsonValue(intensities: VibeIntensities): Prisma.InputJsonValue {
  return intensities as Prisma.InputJsonValue;
}

// Usage:
intensities: toJsonValue(intensities),
```

#### `const where: any` (line 274)

```ts
// CURRENT CODE:
const where: any = {
  userId,
  ...(postId ? { postId } : { commentId: commentId! }),
};

if (nodeId) {
  where.nodeId = nodeId;
}
```

```ts
// FIXED CODE:
import type { Prisma } from '../../generated/prisma/client.js';

const where: Prisma.VibeReactionWhereInput = {
  userId,
  ...(postId ? { postId } : { commentId: commentId! }),
  ...(nodeId ? { nodeId } : {}),
};
```

**Why:** `Prisma.VibeReactionWhereInput` is the generated type for the `where` clause of
`vibeReaction.findFirst()`. It knows every valid field you can filter on. If you misspell
`nodeId` or try to filter on a field that does not exist, TypeScript catches it.

**Where the type comes from:** Prisma generates it from your schema. Every model gets a
`ModelWhereInput` type. Access them all via `Prisma.XxxWhereInput`.

Note: By inlining the conditional spread (`...(nodeId ? { nodeId } : {})`), you avoid
mutating the object after creation, which is both cleaner TypeScript and cleaner code
in general.

#### `reaction.intensities as VibeIntensities` (lines 203, 235, 333)

```ts
// CURRENT CODE (reading from Prisma):
const intensities = reaction.intensities as VibeIntensities;
```

This cast is correct and necessary. Prisma stores `Json` fields as `Prisma.JsonValue`
(which is `string | number | boolean | null | JsonObject | JsonArray`). You know the
runtime shape is `VibeIntensities` because you control what gets written. This is a
safe assertion.

To be extra safe, you could validate at runtime:

```ts
function parseIntensities(json: Prisma.JsonValue): VibeIntensities {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return {};
  }
  // json is JsonObject at this point
  const result: VibeIntensities = {};
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}
```

But for a codebase where you control both reads and writes, the assertion is fine.

---

### Backend: moderation.ts (routes)

**File:** `backend/api/src/routes/moderation.ts`

#### `const where: any = {}` (line 29)

```ts
// CURRENT CODE:
const where: any = {};
if (targetType) where.targetType = targetType;
if (targetId) where.targetId = targetId;
```

```ts
// FIXED CODE:
import type { Prisma } from '../../generated/prisma/client.js';

const where: Prisma.ModActionLogWhereInput = {
  ...(targetType ? { targetType } : {}),
  ...(targetId ? { targetId } : {}),
};
```

**Why:** Same pattern as vibeService.ts. `Prisma.ModActionLogWhereInput` is the generated
type for `modActionLog.findMany({ where })`. Use conditional spreads instead of mutation.

#### `z.record(z.any())` (line 66)

```ts
// CURRENT CODE:
metadata: z.record(z.any()).optional(),
```

```ts
// FIXED CODE:
metadata: z.record(z.string(), z.unknown()).optional(),
```

**Why:** `z.any()` disables validation for the values inside the record. `z.unknown()` still
accepts any value (so it does not break existing callers) but gives you `unknown` instead
of `any` in the inferred type. This means you have to narrow before using the values, which
prevents bugs.

If you know the metadata always contains strings:

```ts
metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
```

---

### Backend: moderation.ts (lib)

**File:** `backend/api/src/lib/moderation.ts`

#### `metadata?: Record<string, any>` (line 21)

```ts
// CURRENT CODE:
options?: {
  moderatorId?: string | null;
  reason?: string;
  metadata?: Record<string, any>;
}
```

```ts
// FIXED CODE:
options?: {
  moderatorId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}
```

**Why:** `Record<string, unknown>` accepts all the same values as `Record<string, any>`, but
forces you to narrow before using the values. Since this metadata is passed directly to
Prisma's `Json` field, you could also use:

```ts
metadata?: Prisma.InputJsonObject;
```

---

### Frontend: App.tsx

**File:** `app/App.tsx`

This file has the most `any` usages. Here is every one.

#### `useState<any[]>([])` for posts (line 34)

```ts
// CURRENT CODE:
const [posts, setPosts] = useState<any[]>([]);
```

You are mapping API responses into a UI shape. Define that shape as an interface:

```ts
// FIXED CODE:
// This interface already exists in Feed.tsx -- import it or move to a shared file
import type { UIPost } from './src/components/ui/Feed';
// (You would need to export UIPost from Feed.tsx)

const [posts, setPosts] = useState<UIPost[]>([]);
```

Or define it inline if you prefer:

```ts
interface MappedPost {
  id: string;
  node: { name: string; color: string };
  author: {
    username: string;
    avatar: string;
    era: string;
    connoisseurCred: number;
  };
  title: string;
  content: string;
  commentCount: number;
  expertGated: boolean;
  vibes: string[];
  linkMeta?: {
    id: string;
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  } | null;
  comments: Array<{
    id: string;
    author: {
      username: string;
      avatar: string;
      era: string;
      connoisseurCred: number;
    };
    content: string;
    timestamp: Date;
    depth: number;
    replies: never[];
  }>;
}

const [posts, setPosts] = useState<MappedPost[]>([]);
```

**Why:** Now TypeScript checks that `fetchFeed` actually produces objects that match this
shape. If you rename `commentCount` to `comments` on the backend, TypeScript catches the
mismatch immediately.

#### `useState<any[]>([])` for nodes (line 47)

```ts
// CURRENT CODE:
const [nodes, setNodes] = useState<any[]>([]);
```

```ts
// FIXED CODE:
import type { Node } from './src/lib/api';

interface UINode extends Node {
  type: string;
  vibeVelocity: number;
  color: string;
}

const [nodes, setNodes] = useState<UINode[]>([]);
```

**Why:** The `Node` type from `api.ts` has `{ id, name, slug, description }`. You add
`type`, `vibeVelocity`, and `color` in the mapping function. Extending `Node` captures both.

#### `(n: any)` in `fetchNodes` (line 53)

```ts
// CURRENT CODE:
const mappedNodes = data.map((n: any) => ({
  ...n,
  type: 'child',
  vibeVelocity: Math.floor(Math.random() * 100),
  color: SCOPE_COLORS[Math.floor(Math.random() * SCOPE_COLORS.length)]
}));
```

```ts
// FIXED CODE:
// data is already typed as Node[] (from getNodes() return type)
// so n is automatically Node -- no annotation needed
const mappedNodes = data.map((n) => ({
  ...n,
  type: 'child' as const,
  vibeVelocity: Math.floor(Math.random() * 100),
  color: SCOPE_COLORS[Math.floor(Math.random() * SCOPE_COLORS.length)]
}));
```

**Why:** `getNodes()` returns `Promise<Node[]>`. The `.map()` callback parameter `n` is
automatically inferred as `Node`. The `(n: any)` annotation was overriding the correct
inferred type.

#### `(p: any)` in `fetchFeed` and `handleSearch` (lines 71, 86, 124, 139)

```ts
// CURRENT CODE:
const mappedPosts = data.posts.map((p: any) => ({
  id: p.id,
  node: { name: p.node?.name || 'Global', color: '#6366f1' },
  // ...
  comments: p.comments?.map((c: any) => ({
    // ...
  }))
}));
```

```ts
// FIXED CODE:
// data.posts is already typed as Post[] from getFeed()'s return type
// Remove the explicit : any annotations and let TypeScript infer
const mappedPosts = data.posts.map((p) => ({
  id: p.id,
  node: { name: p.node?.name || 'Global', color: '#6366f1' },
  author: {
    username: p.author.email.split('@')[0],
    avatar: `https://picsum.photos/seed/${p.author.id}/200`,
    era: 'Builder Era',
    connoisseurCred: 420
  },
  title: p.title || 'Untitled Post',
  content: p.content,
  commentCount: p.commentCount,
  expertGated: false,
  vibes: [] as string[],
  linkMeta: p.linkMeta,
  comments: (p as Post & { comments?: Array<{ id: string; author: { id: string; email: string }; content: string; createdAt: string }> }).comments?.map((c) => ({
    id: c.id,
    author: {
      username: c.author.email.split('@')[0],
      avatar: `https://picsum.photos/seed/${c.author.id}/200`,
      era: 'Builder Era',
      connoisseurCred: 100
    },
    content: c.content,
    timestamp: new Date(c.createdAt),
    depth: 0,
    replies: [] as never[]
  })) || []
}));
```

Note on the `comments` field: Your `Post` type in `api.ts` does not include `comments` --
it only has `commentCount`. The backend attaches `comments` via the `include` in the query,
but your frontend `Post` type does not reflect that. The cleanest fix is to add comments to
the type:

```ts
// In api.ts, update the Post type:
export type Post = {
  id: string;
  content: string;
  title?: string | null;
  author: { id: string; email: string };
  nodeId?: string | null;
  node?: Node | null;
  commentCount: number;
  createdAt: string;
  updatedAt?: string;
  linkUrl?: string | null;
  linkMeta?: { id: string; url: string; title?: string; description?: string; image?: string; domain?: string } | null;
  // Add this:
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; email: string };
  }>;
};
```

Then `p.comments?.map((c) => ...)` works without any cast because `c` is automatically typed.

---

### Frontend: api.ts

**File:** `app/src/lib/api.ts`

#### `(body as any)?.error` (line 221)

```ts
// CURRENT CODE:
const body = await res.json().catch(() => ({}));
const message = (body as any)?.error || `HTTP ${res.status}`;
```

```ts
// FIXED CODE:
const body: unknown = await res.json().catch(() => ({}));
const message =
  (typeof body === 'object' && body !== null && 'error' in body && typeof (body as Record<string, unknown>).error === 'string')
    ? (body as Record<string, unknown>).error as string
    : `HTTP ${res.status}`;
```

That is verbose. A cleaner approach using a helper:

```ts
function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const err = (body as { error: unknown }).error;
    return typeof err === 'string' ? err : fallback;
  }
  return fallback;
}

// Usage:
const body: unknown = await res.json().catch(() => ({}));
const message = extractErrorMessage(body, `HTTP ${res.status}`);
```

**Why:** `res.json()` returns `Promise<any>` by the Fetch spec. By explicitly typing `body`
as `unknown`, you make the narrowing explicit. The helper function keeps the call site clean.

---

### Frontend: Sidebar.tsx

**File:** `app/src/components/ui/Sidebar.tsx`

#### `nodes: any[]`, `user?: any`, `icon: any` (lines 8, 11, 116)

```ts
// CURRENT CODE:
interface SidebarProps {
  nodes: any[];
  onClose?: () => void;
  isDesktop?: boolean;
  user?: any;
  onProfileClick?: () => void;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
}

interface NavItemProps {
  icon: any;
  label: string;
  active?: boolean;
  onPress?: () => void;
}
```

```ts
// FIXED CODE:
import type { Node } from '../../lib/api';
import type { AuthResponse } from '../../lib/api';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg'; // or from lucide-react-native

// Define the extended node type used in the sidebar
interface SidebarNode extends Node {
  color?: string;
  vibeVelocity?: number;
}

type User = AuthResponse['user'];

interface SidebarProps {
  nodes: SidebarNode[];
  onClose?: () => void;
  isDesktop?: boolean;
  user?: User | null;
  onProfileClick?: () => void;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
}

// For icon components (lucide-react-native icons), use this pattern:
interface NavItemProps {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  active?: boolean;
  onPress?: () => void;
}
```

**Why `ComponentType<{ size?: number; color?: string }>` for icons:** All your icon
components (from lucide-react-native) accept `size` and `color` props. `ComponentType` is a
React type that means "a component I can render with these props." This is much better than
`any` because TypeScript will catch it if you try to pass a non-component.

---

### Frontend: VibeValidator.tsx

**File:** `app/src/components/ui/VibeValidator.tsx`

#### `CustomSlider` props (line 25)

```ts
// CURRENT CODE:
const CustomSlider = ({ value, onChange, color, label, icon: Icon }: any) => {
```

```ts
// FIXED CODE:
import type { ComponentType } from 'react';

interface CustomSliderProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
}

const CustomSlider = ({ value, onChange, color, label, icon: Icon }: CustomSliderProps) => {
```

#### `VibeValidator` props (line 79)

```ts
// CURRENT CODE:
export const VibeValidator = ({
  settings = { weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 } },
  onUpdate
}: any) => {
```

```ts
// FIXED CODE:
interface AlgoWeights {
  quality: number;
  recency: number;
  engagement: number;
  personalization: number;
}

interface AlgoSettings {
  preset: string;
  weights: AlgoWeights;
}

interface VibeValidatorProps {
  settings?: AlgoSettings;
  onUpdate: (settings: AlgoSettings) => void;
}

const defaultSettings: AlgoSettings = {
  preset: 'balanced',
  weights: { quality: 35, recency: 30, engagement: 20, personalization: 15 },
};

export const VibeValidator = ({
  settings = defaultSettings,
  onUpdate
}: VibeValidatorProps) => {
```

**Why:** This gives you autocomplete for `settings.weights.quality`, catches typos like
`settings.weights.qualty`, and documents the component's API for other developers (or future
you).

---

### Frontend: Feed.tsx

**File:** `app/src/components/ui/Feed.tsx`

#### `vibes?: any[]` in UIPost interface (line 50)

```ts
// CURRENT CODE:
interface UIPost {
  // ...
  vibes?: any[];
  // ...
}
```

```ts
// FIXED CODE:
interface UIPost {
  // ...
  vibes?: string[];  // Vibe vector slugs, e.g., ["funny", "insightful"]
  // ...
}
```

**Why:** Looking at App.tsx, vibes is always set to `[]` (an empty array). When you implement
vibes in the UI, they will likely be vibe vector slugs (strings). If they turn out to be
objects with more structure, define a `UIVibe` interface then.

---

### Frontend: CreatePostModal.tsx

**File:** `app/src/components/ui/CreatePostModal.tsx`

#### `useState<any | null>(null)` for linkPreview (line 41)

```ts
// CURRENT CODE:
const [linkPreview, setLinkPreview] = useState<any | null>(null);
```

```ts
// FIXED CODE:
interface LinkPreview {
  id: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
```

**Why:** This is the same shape returned by `getLinkPreview()` in `api.ts`. You already
defined the return type there -- reuse it:

```ts
// Even better -- import the type from api.ts
// First, export the type from api.ts by adding:
//   export type LinkPreview = { id: string; url: string; title?: string; ... }
// Then import it here.
```

#### `catch (err: any)` (line 95)

```ts
// CURRENT CODE:
} catch (err: any) {
  setError(err.message || 'Failed to create post');
}
```

```ts
// FIXED CODE:
} catch (err: unknown) {
  setError(err instanceof Error ? err.message : 'Failed to create post');
}
```

---

### Frontend: LoginScreen.tsx

**File:** `app/src/screens/LoginScreen.tsx`

#### `catch (e: any)` on login (line 127)

```ts
// CURRENT CODE:
} catch (e: any) {
  setError(e.message ?? 'Something went wrong');
}
```

```ts
// FIXED CODE:
} catch (e: unknown) {
  setError(e instanceof Error ? e.message : 'Something went wrong');
}
```

#### `catch (e: any)` on Google callback (line 142)

Same fix as above.

#### `(googleResponse as any).params` and friends (lines 159, 160, 170, 187)

```ts
// CURRENT CODE:
console.log("Google OAuth Response:", {
  type: googleResponse.type,
  params: (googleResponse as any).params,
  error: (googleResponse as any).error,
});
// ...
(googleResponse as any).authentication?.idToken;
// ...
(googleResponse as any).error?.error_description
```

These casts are needed because `expo-auth-session` types the response as a discriminated
union, but you are accessing properties before narrowing.

```ts
// FIXED CODE:
// For the debug log, use type narrowing or just log the whole object:
console.log("Google OAuth Response:", googleResponse);

// For accessing params after the type === 'success' check,
// the expo types should already give you access. If not, cast to a specific type:
if (googleResponse.type === 'success') {
  const params = googleResponse.params as Record<string, string>;
  const token =
    params.id_token ||
    params.idToken ||
    params.token;
  // ...
}

if (googleResponse.type === 'error') {
  const errorMsg =
    googleResponse.error?.message ??
    'Google sign-in was interrupted. Please try again.';
  // ...
}
```

The `authentication?.idToken` access is the trickiest because `expo-auth-session` does not
always include `authentication` in its types. For this specific case, a targeted assertion
is acceptable:

```ts
interface GoogleSuccessResponse {
  type: 'success';
  params: Record<string, string>;
  authentication?: { idToken?: string };
}

if (googleResponse.type === 'success') {
  const response = googleResponse as GoogleSuccessResponse;
  const token =
    response.params.id_token ||
    response.authentication?.idToken;
}
```

#### `catch (err: any)` on Apple login (line 313)

```ts
// CURRENT CODE:
} catch (err: any) {
  if (err?.code === 'ERR_REQUEST_CANCELED') {
    setAppleLoading(false);
    return;
  }
  if (err?.code === '1000' || err?.message?.includes('1000')) {
    // ...
  }
}
```

```ts
// FIXED CODE:
} catch (err: unknown) {
  const code = err instanceof Error && 'code' in err
    ? (err as Error & { code: string }).code
    : undefined;
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'ERR_REQUEST_CANCELED') {
    setAppleLoading(false);
    return;
  }

  if (code === '1000' || message.includes('1000')) {
    console.error('Apple Sign-In Error 1000: Missing entitlement');
    setError('Apple Sign-In is not properly configured. Please contact support.');
  } else {
    setError(message || 'Apple sign-in failed. Please try again.');
  }
  setAppleLoading(false);
}
```

---

### Frontend: Error Catches Across All Screens

The `catch (e: any)` pattern appears in several screen files:

- `RegisterScreen.tsx` line 123
- `ForgotPasswordScreen.tsx` line 35
- `ResetPasswordScreen.tsx` line 49
- `VerifyEmailScreen.tsx` lines 68, 90

**The fix is the same for all of them:**

```ts
// BEFORE:
} catch (e: any) {
  setError(e.message ?? 'Something went wrong');
}

// AFTER:
} catch (e: unknown) {
  setError(e instanceof Error ? e.message : 'Something went wrong');
}
```

This is such a common pattern that you might want a utility function:

```ts
// Put this in app/src/lib/errors.ts
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

// Then in every catch block:
} catch (e: unknown) {
  setError(getErrorMessage(e));
}
```

---

## Part 3: Patterns for Your Stack

### Prisma + TypeScript

Prisma generates types from your `schema.prisma` file. These are the best types in your
codebase -- use them everywhere.

**Where to find generated types:**

```
backend/api/generated/prisma/client.js  <-- the runtime client
backend/api/generated/prisma/index.d.ts <-- the type declarations
```

**Import the namespace, not individual types:**

```ts
import type { Prisma } from '../../generated/prisma/client.js';
```

The `Prisma` namespace contains hundreds of generated types. Here are the ones you need most:

**1. `Prisma.XxxWhereInput` -- for `where` clauses:**

```ts
// Instead of: const where: any = {};
const where: Prisma.PostWhereInput = {
  deletedAt: null,
  ...(nodeId ? { nodeId } : {}),
};
```

Every model gets one: `Prisma.UserWhereInput`, `Prisma.CommentWhereInput`,
`Prisma.VibeReactionWhereInput`, etc.

**2. `Prisma.XxxGetPayload<>` -- for query results with includes:**

```ts
// Define the include object
const postInclude = {
  author: { select: { id: true, email: true } },
  node: { select: { id: true, slug: true, name: true } },
  metrics: true,
  _count: { select: { comments: true } },
} as const;  // <-- as const is critical here!

// Derive the type from the include
type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

// PostWithRelations now has:
//   .author: { id: string; email: string }
//   .node: { id: string; slug: string; name: string } | null
//   .metrics: PostMetric | null
//   ._count: { comments: number }
```

The `as const` on the include object is critical. Without it, TypeScript widens the type
and `Prisma.PostGetPayload` cannot determine which fields are included.

**3. `Prisma.InputJsonValue` -- for Json fields:**

```ts
// When writing to a Json field:
await prisma.vibeReaction.create({
  data: {
    intensities: myObject as Prisma.InputJsonValue,
  },
});

// When reading from a Json field:
const data = reaction.intensities as VibeIntensities;
// (You know the shape because you wrote it)
```

**4. `Prisma.XxxCreateInput` -- for create data:**

```ts
const data: Prisma.PostCreateInput = {
  content: 'Hello',
  author: { connect: { id: userId } },
};
```

**5. `Prisma.XxxUpdateInput` -- for update data:**

```ts
const data: Prisma.UserUpdateInput = {
  bio: 'New bio',
  emailVerified: true,
};
```

### Zod + TypeScript

Zod schemas double as type definitions. Instead of defining a schema AND a type separately,
derive the type from the schema.

**The core pattern: `z.infer<typeof schema>`**

```ts
// Define the schema once
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().datetime(),
});

// Derive the type from the schema -- zero duplication
type RegisterInput = z.infer<typeof registerSchema>;
// RegisterInput = {
//   email: string;
//   password: string;
//   username: string;
//   firstName: string;
//   lastName: string;
//   dateOfBirth: string;
// }
```

**Using it after validation:**

```ts
const parsed = registerSchema.safeParse(request.body);
if (!parsed.success) {
  return reply.status(400).send({ error: 'Invalid input' });
}

// parsed.data is already typed as RegisterInput
// TypeScript knows about .email, .password, etc.
const { email, password, username } = parsed.data;
```

You already do this correctly in every route -- the `parsed.data` is typed. The key insight
is that you can extract and export those types for use elsewhere:

```ts
// Export for use in frontend or tests
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

**Zod schema = runtime validation + compile-time type, in one definition.**

### Fastify + TypeScript

Fastify has deep TypeScript support through generics on route methods and declaration
merging for plugins.

**1. Route handler generics:**

Fastify route methods (`.get()`, `.post()`, etc.) accept a generic parameter that describes
the request shape:

```ts
interface RouteTypes {
  Params: { id: string };
  Querystring: { limit?: string; offset?: string };
  Body: { content: string; nodeId?: string };
  Reply: { id: string; content: string };  // Optional: type the response too
}

fastify.post<RouteTypes>('/:id', async (request, reply) => {
  request.params.id;       // string -- typed!
  request.query.limit;     // string | undefined -- typed!
  request.body.content;    // string -- typed!
});
```

**Combined with Zod (the pattern for your codebase):**

Since you validate with Zod inside the handler, typing the `Body` generic is somewhat
redundant. The pragmatic approach for your codebase:

```ts
// Type Params and Querystring (no runtime validation needed for these)
// Let Zod handle Body validation inside the handler
fastify.post<{ Params: { postId: string } }>(
  '/posts/:postId/comments',
  { onRequest: [fastify.authenticate] },
  async (request, reply) => {
    const { postId } = request.params; // Typed from generic

    const schema = z.object({
      content: z.string().min(1).max(2000),
      parentId: z.string().uuid().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { content, parentId } = parsed.data; // Typed from Zod
  }
);
```

**2. Declaration merging for plugins:**

You already do this correctly. Here is the pattern summarized:

```ts
// Step 1: In the plugin file, declare the addition to FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Step 2: In the plugin, decorate the instance
fastify.decorate('prisma', prisma);

// Step 3: In route files, access it with full type safety
fastify.prisma.user.findMany(...); // Fully typed!
```

Your `plugins/prisma.ts`, `plugins/redis.ts`, and `plugins/meilisearch.ts` all do this
correctly. The `index.ts` authenticate decorator should follow the same pattern (as shown
in Part 2).

**3. The `@fastify/jwt` declaration for `request.user`:**

```ts
// Add this to index.ts or a types.ts file:
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}
```

This tells the JWT plugin what your token payload looks like. After this,
`request.user.sub` is typed automatically in every route handler that uses
`fastify.authenticate` as an `onRequest` hook.

### React + TypeScript

**1. Component props:**

You already know how to type props with interfaces. The key patterns:

```ts
// Function component with props interface
interface PostCardProps {
  post: UIPost;
  onPress?: () => void;
}

const PostCard = ({ post, onPress }: PostCardProps) => {
  // ...
};

// Or using React.FC (your CreatePostModal already uses this)
export const CreatePostModal: React.FC<CreatePostModalProps> = ({ visible, onClose }) => {
  // ...
};
```

Both styles work. Pick one and be consistent.

**2. `useState` generics:**

```ts
// TypeScript infers the type from the initial value when it can:
const [loading, setLoading] = useState(false);         // boolean
const [error, setError] = useState<string | null>(null); // string | null
const [count, setCount] = useState(0);                 // number

// You need the generic when the initial value does not carry enough info:
const [posts, setPosts] = useState<Post[]>([]);         // Post[] (not never[])
const [user, setUser] = useState<User | null>(null);    // User | null (not null)
```

**Rule of thumb:** If the initial value is `[]`, `null`, or `undefined`, provide the generic.
If it is a concrete value like `false`, `0`, or `'hello'`, let TypeScript infer.

**3. Event handlers:**

```ts
// TextInput change handler
const handleChange = (text: string) => {
  setSearchQuery(text);
};
// onChangeText={handleChange}

// Layout event
const handleLayout = (e: LayoutChangeEvent) => {
  setWidth(e.nativeEvent.layout.width);
};

// Touch event
const handlePress = () => {
  // void return
};
```

For React Native, most event types come from `react-native`:

```ts
import type { LayoutChangeEvent, GestureResponderEvent } from 'react-native';
```

**4. Typing icon components (your recurring pattern):**

```ts
import type { ComponentType } from 'react';

// This type matches all lucide-react-native icons
type IconComponent = ComponentType<{ size?: number; color?: string }>;

interface NavItemProps {
  icon: IconComponent;
  label: string;
}
```

### Zustand + TypeScript

Your auth store in `app/src/store/auth.ts` is already well-typed. Here is why it works and
how to replicate the pattern for new stores.

**The pattern:**

```ts
import { create } from 'zustand';

// Step 1: Define the state and actions as a single type
type AuthState = {
  // State
  user: User | null;
  token: string | null;
  loading: boolean;

  // Actions
  setAuth: (data: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
};

// Step 2: Pass the type to create<>
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: async (data) => {
    // `data` is typed as AuthResponse
    // `set` knows it takes Partial<AuthState>
    set({ user: data.user, token: data.token, loading: false });
  },

  logout: async () => {
    set({ user: null, token: null });
  },
}));
```

**Key points from your auth store that make it well-typed:**

1. `type User = AuthResponse['user']` -- derives the user type from the API response type.
   No duplication.

2. The `create<AuthState>()` generic ensures every property and method matches the type.

3. `set()` is typed to accept `Partial<AuthState>`, so TypeScript catches invalid state
   updates.

**To create a new store, follow the same pattern:**

```ts
type FeedState = {
  posts: Post[];
  loading: boolean;
  cursor: string | null;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[], cursor: string | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  loading: false,
  cursor: null,

  setPosts: (posts) => set({ posts, cursor: null }),
  appendPosts: (posts, cursor) => set((state) => ({
    posts: [...state.posts, ...posts],
    cursor,
  })),
  setLoading: (loading) => set({ loading }),
}));
```

---

## Part 4: Quick Reference Cheat Sheet

### Common Patterns

**Get the type of a Prisma query result:**

```ts
const include = { author: { select: { id: true } } } as const;
type Result = Prisma.PostGetPayload<{ include: typeof include }>;
```

**Get a TypeScript type from a Zod schema:**

```ts
const schema = z.object({ email: z.string().email() });
type Input = z.infer<typeof schema>;
```

**Type a function parameter as "any React component that takes these props":**

```ts
icon: ComponentType<{ size?: number; color?: string }>
```

**Type an object where you do not know the keys but know the value type:**

```ts
// All values are numbers:
type Intensities = Record<string, number>;
// Same as: { [key: string]: number }
```

**Type a value that could be one of several literal strings:**

```ts
type Action = 'delete' | 'hide' | 'warn' | 'ban';
```

**Extract a nested type from another type:**

```ts
type User = AuthResponse['user'];
// Gives you the type of the `user` property on AuthResponse
```

**Type the return value of an async function:**

```ts
async function fetchUser(): Promise<User | null> {
  // ...
}
```

### Instead of X, Do Y

| Instead of... | Do this | Why |
|---|---|---|
| `catch (e: any)` | `catch (e: unknown)` | Forces safe narrowing |
| `(request.user as { sub: string }).sub` | Declare `FastifyJWT` interface | One declaration, all routes typed |
| `const where: any = {}` | `const where: Prisma.XxxWhereInput = {}` | Prisma knows valid filter fields |
| `useState<any[]>([])` | `useState<Post[]>([])` | Enables autocomplete in `.map()` |
| `(p: any) =>` in `.map()` | `(p) =>` (delete the annotation) | TypeScript infers from the array type |
| `x as any` (for Prisma Json) | `x as Prisma.InputJsonValue` | Still validates it is valid JSON |
| `props: any` on components | Define a `Props` interface | Documents the component API |
| `icon: any` | `icon: ComponentType<{...}>` | Ensures only components are passed |
| `error.message` after catch | `error instanceof Error ? error.message : String(error)` | Safe for non-Error throws |
| `(response as any).field` | Narrow with `if` checks or define an interface | Catches incorrect field access |

### Reading TypeScript Error Messages

TypeScript error messages look intimidating but follow patterns. Here is how to read the
most common ones you will see in this codebase.

**1. "Type 'X' is not assignable to type 'Y'"**

```
Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
```

**Translation:** You have a value that might be `undefined`, but you are using it where only
`string` is accepted.

**Fix:** Add a null check or provide a default:

```ts
const value: string | undefined = getSomething();
const safe: string = value ?? 'default';  // Provide a default
// or
if (value !== undefined) {
  // TypeScript now knows value is string in here
}
```

**2. "Property 'X' does not exist on type 'Y'"**

```
Property 'sub' does not exist on type 'unknown'.
```

**Translation:** You are trying to access `.sub` on a value TypeScript does not know has
that property.

**Fix:** Narrow the type first:

```ts
if (typeof obj === 'object' && obj !== null && 'sub' in obj) {
  const sub = (obj as { sub: string }).sub;
}
```

Or use the `@fastify/jwt` declaration merging fix from Part 2.

**3. "Argument of type 'X' is not assignable to parameter of type 'Y'"**

```
Argument of type '{ intensities: VibeIntensities }' is not assignable
to parameter of type '{ intensities: InputJsonValue }'.
```

**Translation:** You are passing an object to a function, but one of the properties has the
wrong type.

**Fix:** Cast the specific property (not the whole object):

```ts
{
  intensities: intensities as Prisma.InputJsonValue,
}
```

**4. "Object is possibly 'undefined'"**

```
Object is possibly 'undefined'.
  const x = arr[0].name;
               ~~~
```

**Translation:** TypeScript is not sure the value exists. Your `tsconfig.json` has
`noUncheckedIndexedAccess: true`, which means array index access returns `T | undefined`.

**Fix:** Check before using:

```ts
const first = arr[0];
if (first) {
  console.log(first.name);
}
// or
const name = arr[0]?.name ?? 'default';
```

**5. "Cannot find module 'X' or its corresponding type declarations"**

**Translation:** TypeScript cannot find types for a package.

**Fix:** Install the types package:

```bash
npm install -D @types/package-name
```

Or if the package ships its own types (most modern packages do), make sure the import path
is correct.

**6. "Type 'X' has no properties in common with type 'Y'"**

This often happens with Prisma when you pass the wrong shape to a query:

```
Type '{ userId: string }' has no properties in common with type 'PostWhereInput'.
```

**Translation:** You are passing fields that do not exist on the expected type.

**Fix:** Check the Prisma-generated type to see what fields are valid. Use your IDE's
autocomplete (Ctrl+Space) on the object to see all valid properties.

---

## Summary: Priority Order for Cleanup

If you want to clean up the codebase incrementally, here is the order that gives you the
most benefit for the least work:

1. **Add the `@fastify/jwt` declaration** (5 minutes, fixes 15+ files). This single change
   eliminates every `(request.user as { sub: string }).sub` cast in the entire backend.

2. **Fix the `authenticate` decorator types** (2 minutes). Change `any` to `FastifyRequest`
   and `FastifyReply` in `index.ts`.

3. **Fix `issueSessionCookies` and `clearSessionCookies`** (2 minutes). Change `any` to
   `FastifyReply` in `auth.ts`.

4. **Replace `where: any` with Prisma types** (5 minutes, 2 files). Use
   `Prisma.XxxWhereInput` in `vibeService.ts` and `moderation.ts`.

5. **Fix `intensities as any`** (2 minutes). Use `Prisma.InputJsonValue` in
   `vibeService.ts`.

6. **Create the `getErrorMessage` utility** (5 minutes). Then find-and-replace every
   `catch (e: any)` across the frontend.

7. **Type the frontend component props** (15 minutes). Fix `Sidebar.tsx`,
   `VibeValidator.tsx`, `Feed.tsx`.

8. **Type the `useState` calls in `App.tsx`** (10 minutes). Define `UINode` and use the
   existing `UIPost` from `Feed.tsx`.

Total: about 45 minutes to eliminate every `any` in the codebase.
