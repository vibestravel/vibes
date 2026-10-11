import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";

const COOKIE = "vibes_session";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export type SessionUser = { id: string; name: string; email: string; role: Role; departmentId: string | null };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function login(email: string, password: string): Promise<boolean> {
  const [u] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (!u || !u.active) {
    await bcrypt.compare(password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8DOLn6z8bm5uHGPgtTHFBAX8ABdVOa"); // constant time
    return false;
  }
  if (!(await bcrypt.compare(password, u.passwordHash))) return false;
  const token = await new SignJWT({ sub: u.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await db.select().from(users).where(eq(users.id, String(payload.sub)));
    if (!u || !u.active) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role, departmentId: u.departmentId };
  } catch {
    return null;
  }
}

/** Use in pages and server actions. Redirects to /login or throws when the role is not allowed. */
export async function requireUser(allowed?: Role[]): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (allowed && !allowed.includes(s.role) && s.role !== "CEO") redirect("/?denied=1");
  return s;
}
