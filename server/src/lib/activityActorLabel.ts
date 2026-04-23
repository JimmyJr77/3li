/** Display label for Activity Tracker rows (task history + workspace feed). */

export type ActivityActorUserFields = {
  id: string;
  username: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function activityActorDto(user: ActivityActorUserFields | null | undefined): {
  id: string;
  label: string;
} | null {
  if (!user) return null;
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const label = (user.displayName?.trim() || combined || user.username || "").trim();
  return { id: user.id, label: label || user.username };
}
