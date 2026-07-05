import { Elysia } from "elysia";
import { verifyToken } from "../utils/auth";

export const authGuard = new Elysia().derive(
  { as: "scoped" },
  ({ headers, set }) => {
    const authHeader = headers["authorization"];
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      set.status = 401;
      throw new Error("Missing token");
    }

    const payload = verifyToken(token);
    if (!payload) {
      set.status = 401;
      throw new Error("Invalid or expired token");
    }

    return { user: payload };
  }
);