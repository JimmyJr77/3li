import { Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { startTransition, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { PublicThemeToggle } from "@/components/shared/PublicThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/solutions", label: "Solutions" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicLayout() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  /** Vibrant / rainbow clash with marketing palette — normalize once when entering public shell. */
  useEffect(() => {
    if (!mounted) return;
    if (theme === "vibrant" || theme === "rainbow-explosion") {
      setTheme("dark");
    }
  }, [mounted, theme, setTheme]);

  const marketingDark = resolvedTheme === "dark";

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        marketingDark ? "bg-zinc-950 text-zinc-50" : "bg-zinc-50 text-zinc-950",
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-md",
          marketingDark
            ? "border-white/10 bg-zinc-950/85 supports-[backdrop-filter]:bg-zinc-950/70"
            : "border-zinc-900/10 bg-zinc-50/90 supports-[backdrop-filter]:bg-zinc-50/75",
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className={cn(
              "font-semibold tracking-tight",
              marketingDark ? "text-white" : "text-zinc-900",
            )}
          >
            Three Lions Industries
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)]">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Primary mobile">
                {publicLinks.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        marketingDark
                          ? "text-zinc-400 hover:bg-white/10 hover:text-white"
                          : "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900",
                        isActive &&
                          (marketingDark ? "bg-white/10 text-white" : "bg-zinc-900/10 text-zinc-900"),
                      )
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <Button asChild className="mt-4">
                  <Link to="/login">Log in</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {publicLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    marketingDark
                      ? "text-zinc-400 hover:text-white"
                      : "text-zinc-600 hover:text-zinc-900",
                    isActive && (marketingDark ? "bg-white/10 text-white" : "bg-zinc-900/10 text-zinc-900"),
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <PublicThemeToggle />
            <Button
              asChild
              size="sm"
              className={cn(
                marketingDark
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-red-600 text-white hover:bg-red-500",
              )}
            >
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <Outlet />
      </main>

      {isHome ? (
        <footer
          className={cn(
            "border-t py-10",
            marketingDark ? "border-white/10" : "border-zinc-900/10",
          )}
        >
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p
              className={cn(
                "text-sm font-medium tracking-wide",
                marketingDark ? "text-zinc-400" : "text-zinc-600",
              )}
            >
              Three Lions Industries — Structured Thinking. Relentless Execution.
            </p>
          </div>
        </footer>
      ) : (
        <footer
          className={cn(
            "border-t py-8",
            marketingDark ? "border-white/10" : "border-zinc-900/10",
          )}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Separator className={cn("mb-6", marketingDark ? "bg-white/10" : "bg-zinc-900/10")} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={cn(
                  "text-sm",
                  marketingDark ? "text-zinc-500" : "text-zinc-600",
                )}
              >
                © {new Date().getFullYear()} Three Lions Industries. Consulting operating system.
              </p>
              <nav
                className={cn(
                  "flex flex-wrap gap-4 text-sm",
                  marketingDark ? "text-zinc-500" : "text-zinc-600",
                )}
              >
                {publicLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={marketingDark ? "hover:text-white" : "hover:text-zinc-900"}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
