import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/features/auth/api";

function registerErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { error?: string } | undefined;
    if (d?.error) return d.error;
  }
  if (err instanceof Error) return err.message;
  return "Could not create account";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      const displayName = String(fd.get("displayName") ?? "").trim() || undefined;
      return register({ username, password, displayName });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      navigate("/app/dashboard");
    },
  });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a username (lowercase letters, numbers, underscore) and a password. You will be signed in
          automatically.
        </p>
        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.reset();
            mutation.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              placeholder="Jane Consultant"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-z0-9_]{3,32}"
              title="3–32 characters: lowercase letters, digits, or underscore"
              placeholder="jane_consultant"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {registerErrorMessage(mutation.error)}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
