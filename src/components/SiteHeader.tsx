import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const linkBase = "rounded-full px-3 py-1.5 text-ink/70 transition-colors hover:text-ink";
const activeProps = { className: "rounded-full bg-brand/15 px-3 py-1.5 text-brand" };

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 bg-white/45 ring-1 ring-black/5 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="font-display text-xl font-bold text-ink">
          CampusCart
        </Link>
        <nav className="ml-2 flex flex-wrap items-center gap-1 text-sm font-medium">
          <Link to="/" activeOptions={{ exact: true }} activeProps={activeProps} className={linkBase}>
            Browse
          </Link>
          {user ? (
            <>
              <Link to="/create" activeProps={activeProps} className={linkBase}>
                Sell
              </Link>
              <Link to="/favorites" activeProps={activeProps} className={linkBase}>
                Favorites
              </Link>
              <Link to="/messages" activeProps={activeProps} className={linkBase}>
                Messages
              </Link>
              <Link to="/dashboard" activeProps={activeProps} className={linkBase}>
                Dashboard
              </Link>
            </>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:text-ink"
              >
                Log out
              </button>
              <Link
                to="/create"
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-frost"
              >
                Sell an item
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                search={{ mode: "signin", redirect: undefined }}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", redirect: undefined }}
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-frost"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
