import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { acceptBrandInvite, fetchBrandInvitePreview, fetchMe } from "@/features/auth/api";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/lib/apiErrorMessage";

export function InviteBrandPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = searchParams.get("token")?.trim() ?? "";

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const previewQuery = useQuery({
    queryKey: ["brand-invite-preview", token],
    queryFn: () => fetchBrandInvitePreview(token),
    enabled: Boolean(token),
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptBrandInvite(token),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["brands-tree"] });
      await qc.invalidateQueries({ queryKey: ["bootstrap"] });
      navigate("/app/dashboard");
    },
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Brand invite</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is missing its token. Ask the brand owner for a new invite.</p>
        <Button type="button" variant="outline" className="mt-6" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <p className="text-sm text-muted-foreground">Loading invite…</p>
      </div>
    );
  }

  if (previewQuery.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link may have expired or already been used. Ask the brand owner to send a fresh invite.
        </p>
        <Button type="button" variant="outline" className="mt-6" asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!previewQuery.data) {
    return null;
  }

  const preview = previewQuery.data;
  const signedIn = Boolean(meQuery.data);
  const emailMatches = signedIn && meQuery.data?.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Join a brand team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{preview.inviterLabel}</span> invited you to collaborate on{" "}
        <span className="font-medium text-foreground">{preview.brandName}</span>.
      </p>
      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Invite email</span>
          <br />
          <span className="font-medium text-foreground">{preview.email}</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          You must register or sign in with that exact address so we can attach the shared workspace to the right
          account.
        </p>
      </div>

      {!signedIn ? (
        <div className="mt-8 space-y-3">
          <Button type="button" className="w-full" asChild>
            <Link to={`/register?invite=${encodeURIComponent(token)}`}>Create account</Link>
          </Button>
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to="/login">I already have an account</Link>
          </Button>
        </div>
      ) : !emailMatches ? (
        <div className="mt-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          <p className="font-medium">Different email on this browser</p>
          <p className="mt-1 text-muted-foreground">
            You are signed in as <span className="font-medium text-foreground">{meQuery.data?.email}</span>, but this
            invite is for <span className="font-medium text-foreground">{preview.email}</span>. Sign out and sign in
            with the invited address, or open the link in a private window after signing in with the correct account.
          </p>
          <Button type="button" variant="outline" className="mt-4" asChild>
            <Link to="/login">Switch account</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={acceptMut.isPending}
            onClick={() => acceptMut.mutate()}
          >
            {acceptMut.isPending ? "Joining…" : "Accept and open workspace"}
          </Button>
          {acceptMut.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {formatApiError(acceptMut.error, "Could not accept invite")}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
