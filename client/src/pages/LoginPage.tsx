import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/api";
import { formatApiError } from "@/lib/apiErrorMessage";

export function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const loginId = String(fd.get("login") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      return login(loginId, password);
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
          Use your email, username, or US phone number (10 digits), plus your password. New here? Create an account from
          the home page.
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
            <Label htmlFor="login">Email, username, or phone</Label>
            <Input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
              required
              placeholder="you@company.com or jane_consultant or 555-123-4567"
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
              {formatApiError(mutation.error, "Sign-in failed")}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in…" : "Continue to workspace"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
