import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/api";

function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { error?: string } | undefined;
    if (d?.error) return d.error;
  }
  if (err instanceof Error) return err.message;
  return "Sign-in failed";
}

export function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      return login(username, password);
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
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your workspace username and password. New here? You can create an account from the home page.
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
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="jimmyobrien"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>
          {mutation.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {loginErrorMessage(mutation.error)}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in…" : "Continue to workspace"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
