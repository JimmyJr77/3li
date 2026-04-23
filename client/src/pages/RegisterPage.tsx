import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBrandInvitePreview, register } from "@/features/auth/api";
import { formatApiError } from "@/lib/apiErrorMessage";
import { formatUsPhoneInput } from "@/lib/phoneUs";

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [inviteEmailPrefill, setInviteEmailPrefill] = useState("");

  const invitePreviewQuery = useQuery({
    queryKey: ["brand-invite-preview", inviteToken],
    queryFn: () => fetchBrandInvitePreview(inviteToken),
    enabled: Boolean(inviteToken),
  });

  useEffect(() => {
    const e = invitePreviewQuery.data?.email;
    if (e) {
      setInviteEmailPrefill(e);
    }
  }, [invitePreviewQuery.data?.email]);

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
      return register({
        username,
        password,
        email,
        phone,
        firstName,
        lastName,
        ...(inviteToken ? { brandInviteToken: inviteToken } : {}),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["brands-tree"] });
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
        {inviteToken && invitePreviewQuery.isSuccess ? (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-medium text-foreground">Brand team invite</p>
            <p className="mt-1 text-muted-foreground">
              After you create your account you will keep your personal workspace and also gain access to the shared
              brand <span className="font-medium text-foreground">{invitePreviewQuery.data.brandName}</span>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Use the email address this invite was sent to ({invitePreviewQuery.data.email}) so the link can attach
              you to the team.
            </p>
          </div>
        ) : null}
        {inviteToken && invitePreviewQuery.isError ? (
          <p className="mt-6 text-sm text-destructive" role="alert">
            This invite link is not valid anymore. You can still register below, but you will not be added to the team
            automatically.
          </p>
        ) : null}
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
              defaultValue={inviteEmailPrefill}
              key={inviteEmailPrefill || "email"}
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
              {formatApiError(mutation.error, "Could not create account")}
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
