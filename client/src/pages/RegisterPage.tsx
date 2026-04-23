import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/features/auth/api";
import { formatUsPhoneInput } from "@/lib/phoneUs";

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
  const [phoneDisplay, setPhoneDisplay] = useState("");

  const mutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      const email = String(fd.get("email") ?? "").trim();
      const firstName = String(fd.get("firstName") ?? "").trim();
      const lastName = String(fd.get("lastName") ?? "").trim();
      const phone = formatUsPhoneInput(phoneDisplay);
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 10) {
        throw new Error("Enter a complete US phone number (10 digits).");
      }
      return register({ username, password, email, phone, firstName, lastName });
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
          Add your name, contact info, and sign-in details. Phone is stored as a US number (###-###-####). You will be
          signed in automatically.
        </p>
        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.reset();
            mutation.mutate(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" type="text" autoComplete="given-name" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" type="text" autoComplete="family-name" required maxLength={80} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile phone (US)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              placeholder="555-123-4567"
              value={phoneDisplay}
              onChange={(e) => setPhoneDisplay(formatUsPhoneInput(e.target.value))}
              aria-describedby="phone-hint"
            />
            <p id="phone-hint" className="text-xs text-muted-foreground">
              Enter 10 digits; formatting is applied automatically.
            </p>
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
