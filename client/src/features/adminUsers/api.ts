import { api } from "@/lib/api/client";
import type { AuthUser } from "@/features/auth/api";

export type AdminAppUserRow = AuthUser & {
  createdAt: string;
  updatedAt: string;
};

export async function fetchAdminUsers(): Promise<AdminAppUserRow[]> {
  const { data } = await api.get<{ users: AdminAppUserRow[] }>("/api/admin/users");
  return data.users;
}

export type AdminCreateUserBody = {
  username: string;
  password: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  role?: "user" | "admin";
};

export async function adminCreateUser(body: AdminCreateUserBody): Promise<AdminAppUserRow> {
  const { data } = await api.post<{ user: AdminAppUserRow }>("/api/admin/users", body);
  return data.user;
}

export type AdminPatchUserBody = Partial<{
  username: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  role: "user" | "admin";
}>;

export async function adminPatchUser(userId: string, body: AdminPatchUserBody): Promise<AdminAppUserRow> {
  const { data } = await api.patch<{ user: AdminAppUserRow }>(`/api/admin/users/${userId}`, body);
  return data.user;
}

export async function adminSetUserPassword(userId: string, newPassword: string): Promise<void> {
  await api.post(`/api/admin/users/${userId}/password`, { newPassword });
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await api.delete(`/api/admin/users/${userId}`);
}
