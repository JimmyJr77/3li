import { api } from "@/lib/api/client";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: string;
};

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<{ user: AuthUser | null }>("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function login(loginId: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/login", { login: loginId, password });
  return data.user;
}

export async function register(body: {
  username: string;
  password: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/register", body);
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}
