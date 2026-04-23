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

export type BrandInvitePreview = {
  brandId: string;
  brandName: string;
  inviterLabel: string;
  email: string;
  expiresAt: string;
};

export async function fetchBrandInvitePreview(token: string): Promise<BrandInvitePreview> {
  const { data } = await api.get<BrandInvitePreview>("/api/auth/brand-invite-preview", {
    params: { token },
  });
  return data;
}

export async function acceptBrandInvite(token: string): Promise<{ ok: true; brandId: string }> {
  const { data } = await api.post<{ ok: true; brandId: string }>("/api/auth/brand-invite/accept", { token });
  return data;
}

export type ProfileUpdateBody = Partial<{
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
}>;

export async function patchProfile(body: ProfileUpdateBody): Promise<AuthUser> {
  const { data } = await api.patch<{ user: AuthUser }>("/api/auth/profile", body);
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/api/auth/change-password", { currentPassword, newPassword });
}

export async function register(body: {
  username: string;
  password: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  brandInviteToken?: string;
}): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/register", body);
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}
