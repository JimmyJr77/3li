import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Shield, Trash2, KeyRound } from "lucide-react";
import { useMemo, useState } from "react";
import {
  adminCreateUser,
  adminDeleteUser,
  adminPatchUser,
  adminSetUserPassword,
  fetchAdminUsers,
  type AdminAppUserRow,
} from "@/features/adminUsers/api";
import type { AuthUser } from "@/features/auth/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/apiErrorMessage";
import { formatUsPhoneInput } from "@/lib/phoneUs";
import { cn } from "@/lib/utils";

type AdminUserAccountsSettingsSectionProps = {
  currentUser: AuthUser;
};

export function AdminUserAccountsSettingsSection({ currentUser }: AdminUserAccountsSettingsSectionProps) {
  const qc = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminAppUserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminAppUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminAppUserRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const createMut = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminPatchUser>[1] }) => adminPatchUser(id, body),
    onSuccess: async () => {
      await invalidate();
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setEditUser(null);
    },
  });

  const passwordMut = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) => adminSetUserPassword(id, pw),
    onSuccess: () => {
      setPasswordUser(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
    },
  });

  const sorted = useMemo(() => {
    const list = usersQuery.data ?? [];
    return [...list].sort((a, b) => a.username.localeCompare(b.username));
  }, [usersQuery.data]);

  return (
    <Card className="w-full" role="region" aria-label="User accounts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 opacity-70" aria-hidden />
          User accounts
        </CardTitle>
        <CardDescription>
          Manage logins for your organization: create users, edit profile fields, assign the administrator role, set
          passwords, or remove accounts. Only administrators see this section.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {usersQuery.isPending ? "Loading accounts…" : `${sorted.length} account(s)`}
          </p>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Add user
          </Button>
        </div>

        {usersQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {formatApiError(usersQuery.error, "Could not load users")}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Phone</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.displayName?.trim() ||
                        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
                        "—"}
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.phone ? formatUsPhoneInput(u.phone) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => setEditUser(u)}>
                        <Pencil className="size-3.5" aria-hidden />
                        <span className="sr-only sm:not-sr-only sm:ml-1">Edit</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setPasswordUser(u)}
                      >
                        <KeyRound className="size-3.5" aria-hidden />
                        <span className="sr-only sm:not-sr-only sm:ml-1">Password</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        disabled={u.id === currentUser.id}
                        onClick={() => setDeleteUser(u)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        <span className="sr-only sm:not-sr-only sm:ml-1">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} mutation={createMut} />
      <EditUserDialog user={editUser} onOpenChange={(o) => !o && setEditUser(null)} mutation={patchMut} />
      <SetPasswordDialog user={passwordUser} onOpenChange={(o) => !o && setPasswordUser(null)} mutation={passwordMut} />
      <DeleteUserDialog user={deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)} mutation={deleteMut} />
    </Card>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
  mutation,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mutation: { isPending: boolean; isError: boolean; error: Error | null; mutateAsync: (b: Parameters<typeof adminCreateUser>[0]) => Promise<AdminAppUserRow> };
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const reset = () => {
    setUsername("");
    setEmail("");
    setPhone("");
    setFirstName("");
    setLastName("");
    setDisplayName("");
    setPassword("");
    setRole("user");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create a new login. A personal workspace is created automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="adm-add-user">Username</Label>
            <Input id="adm-add-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-add-email">Email</Label>
            <Input id="adm-add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-add-phone">Phone (US, optional)</Label>
            <Input
              id="adm-add-phone"
              value={phone}
              onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))}
              placeholder="###-###-####"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adm-add-fn">First name</Label>
              <Input id="adm-add-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-add-ln">Last name</Label>
              <Input id="adm-add-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-add-dn">Display name (optional)</Label>
            <Input id="adm-add-dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-add-role">Role</Label>
            <select
              id="adm-add-role"
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-add-pw">Initial password</Label>
            <Input id="adm-add-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive">{formatApiError(mutation.error, "Could not create user")}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              const digits = phone.replace(/\D/g, "");
              void mutation.mutateAsync({
                username: username.trim(),
                email: email.trim(),
                password,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: displayName.trim() || null,
                role,
                ...(digits.length === 10 ? { phone } : {}),
              });
            }}
          >
            {mutation.isPending ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AdminPatchMutation = {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  mutateAsync: (a: { id: string; body: Parameters<typeof adminPatchUser>[1] }) => Promise<AdminAppUserRow>;
};

function EditUserDialogForm({
  user,
  onClose,
  mutation,
}: {
  user: AdminAppUserRow;
  onClose: () => void;
  mutation: AdminPatchMutation;
}) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ? formatUsPhoneInput(user.phone) : "");
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<"user" | "admin">(user.role === "admin" ? "admin" : "user");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {user.username}</DialogTitle>
        <DialogDescription>Update profile fields or role. Use “Set password” to change credentials.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="space-y-2">
          <Label htmlFor="adm-ed-user">Username</Label>
          <Input id="adm-ed-user" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adm-ed-email">Email</Label>
          <Input id="adm-ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adm-ed-phone">Phone (US, leave blank to clear)</Label>
          <Input id="adm-ed-phone" value={phone} onChange={(e) => setPhone(formatUsPhoneInput(e.target.value))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="adm-ed-fn">First name</Label>
            <Input id="adm-ed-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-ed-ln">Last name</Label>
            <Input id="adm-ed-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adm-ed-dn">Display name</Label>
          <Input id="adm-ed-dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adm-ed-role">Role</Label>
          <select
            id="adm-ed-role"
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        {mutation.isError ? (
          <p className="text-sm text-destructive">{formatApiError(mutation.error, "Could not save")}</p>
        ) : null}
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={() => {
            const digits = phone.replace(/\D/g, "");
            void mutation.mutateAsync({
              id: user.id,
              body: {
                username: username.trim(),
                email: email.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: displayName.trim() ? displayName.trim() : null,
                role,
                phone: digits.length === 10 ? phone : null,
              },
            });
          }}
        >
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

function EditUserDialog({
  user,
  onOpenChange,
  mutation,
}: {
  user: AdminAppUserRow | null;
  onOpenChange: (open: boolean) => void;
  mutation: AdminPatchMutation;
}) {
  const open = Boolean(user);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {user ? (
          <EditUserDialogForm key={user.id} user={user} mutation={mutation} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SetPasswordDialog({
  user,
  onOpenChange,
  mutation,
}: {
  user: AdminAppUserRow | null;
  onOpenChange: (open: boolean) => void;
  mutation: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    mutateAsync: (a: { id: string; pw: string }) => Promise<void>;
  };
}) {
  const open = Boolean(user);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setPw("");
          setPw2("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set password for {user?.username}</DialogTitle>
          <DialogDescription>
            Sets a new password immediately. The user is not notified automatically — share it through your normal
            secure channel.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="adm-pw1">New password</Label>
            <Input id="adm-pw1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-pw2">Confirm password</Label>
            <Input id="adm-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={8} />
          </div>
          {pw && pw2 && pw !== pw2 ? <p className="text-sm text-destructive">Passwords do not match.</p> : null}
          {mutation.isError ? (
            <p className="text-sm text-destructive">{formatApiError(mutation.error, "Could not set password")}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || pw.length < 8 || pw !== pw2 || !user}
            onClick={() => user && void mutation.mutateAsync({ id: user.id, pw })}
          >
            {mutation.isPending ? "Saving…" : "Set password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  onOpenChange,
  mutation,
}: {
  user: AdminAppUserRow | null;
  onOpenChange: (open: boolean) => void;
  mutation: { isPending: boolean; isError: boolean; error: Error | null; mutateAsync: (id: string) => Promise<void> };
}) {
  const open = Boolean(user);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {user?.username}?</DialogTitle>
          <DialogDescription>
            This permanently removes the account and related sessions. Brand ownership and memberships may be updated
            according to database rules. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {mutation.isError ? (
          <p className="text-sm text-destructive">{formatApiError(mutation.error, "Could not delete user")}</p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending || !user}
            onClick={() => user && void mutation.mutateAsync(user.id)}
          >
            {mutation.isPending ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
