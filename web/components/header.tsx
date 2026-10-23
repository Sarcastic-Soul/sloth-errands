import { MoonIcon, SignInIcon, SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { Clock } from "./clock";

export function Header({ user }: { user?: { name?: string; email?: string } }) {
  return (
    <header className="border-b-[3px] border-ink">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-5 sm:px-10">
        <a href="/" className="flex items-center gap-2.5 whitespace-nowrap text-xl font-black leading-none tracking-[-0.02em]">
          <span className="grid size-7 place-items-center bg-signal text-bg">
            <MoonIcon size={17} aria-hidden />
          </span>
          Sloth Errands
        </a>
        <div className="flex items-center gap-3 sm:gap-8">
          {user && (
            <div className="hidden items-center gap-4 text-sm sm:flex">
              <span className="text-ink-2">{user.name ?? user.email}</span>
              <a href="/auth/logout" className="inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline">
                <SignOutIcon size={16} aria-hidden />
                Sign out
              </a>
            </div>
          )}
          {!user && (
            <a href="/auth/login" className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap bg-ink px-3 text-sm font-bold text-bg transition-colors hover:bg-[#33353a]">
              <SignInIcon size={16} aria-hidden />
              Sign in
            </a>
          )}
          <Clock />
        </div>
      </div>
      {user && (
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 pb-3 text-sm sm:hidden">
          <span className="truncate text-ink-2">{user.name ?? user.email}</span>
          <a href="/auth/logout" className="inline-flex shrink-0 items-center gap-1.5 font-bold">
            <SignOutIcon size={16} aria-hidden />
            Sign out
          </a>
        </div>
      )}
    </header>
  );
}
