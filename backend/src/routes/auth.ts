import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../utils/auth";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/signup",
    async ({ body, set }) => {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, body.email),
      });

      if (existing) {
        set.status = 409;
        return { error: "Email already registered" };
      }

      const passwordHash = await hashPassword(body.password);

      const [user] = await db
        .insert(users)
        .values({
          email: body.email,
          name: body.name,
          passwordHash,
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      const token = signToken({ userId: user.id, email: user.email });

      return { user, token };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        name: t.String({ minLength: 1 }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, set }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.email, body.email),
      });

      if (!user) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      const token = signToken({ userId: user.id, email: user.email });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  );
