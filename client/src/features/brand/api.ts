import { api } from "@/lib/api/client";
import type { BrandProfile } from "./types";
import { normalizeBrandProfile } from "./types";

export type BrandProfileResponse = {
  workspaceId: string;
  brandId?: string;
  name: string;
  brandProfile: BrandProfile | null;
};

export async function fetchBrandProfile(workspaceId: string): Promise<BrandProfileResponse> {
  const { data } = await api.get<BrandProfileResponse>(`/api/task-app/workspaces/${workspaceId}/brand-profile`);
  return {
    ...data,
    brandProfile: data.brandProfile ? normalizeBrandProfile(data.brandProfile) : null,
  };
}

export async function saveBrandProfile(workspaceId: string, brandProfile: BrandProfile): Promise<BrandProfileResponse> {
  const { data } = await api.put<BrandProfileResponse>(`/api/task-app/workspaces/${workspaceId}/brand-profile`, {
    brandProfile,
  });
  return {
    ...data,
    brandProfile: data.brandProfile ? normalizeBrandProfile(data.brandProfile) : null,
  };
}

/** Server-formatted brand kit text — same source as Notes/Chat use on the backend. */
export async function fetchBrandKitAiText(workspaceId: string): Promise<string> {
  const { data } = await api.get<{ text: string }>(`/api/task-app/workspaces/${workspaceId}/brand-context-text`);
  return (data.text ?? "").trim();
}
