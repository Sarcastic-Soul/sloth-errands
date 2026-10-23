import { SignInIcon } from "@phosphor-icons/react/dist/ssr";
import { auth0 } from "@/lib/auth0";
import { catalog, loadBoard, type Board } from "@/lib/temporal";
import { Header } from "@/components/header";
import { BoardView } from "@/components/board-view";

export default async function Home() {
  const session = await auth0.getSession();
  if (!session) return <SignedOut />;

  let board: Board | null = null;
  let error: string | undefined;
  try {
    board = await loadBoard();
  } catch (err: any) {
    error = `Temporal did not answer: ${err?.message ?? err}. Is \`bun run temporal\` running?`;
  }
  return (
    <>
      <Header user={session.user} />
      <BoardView initial={board} initialError={error} />
    </>
  );
}

// Before sign-in: the timetable is there, but no times or statuses until you are known
function SignedOut() {
  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-[1320px] gap-12 px-4 pb-20 pt-8 sm:px-10 sm:pt-12 lg:grid-cols-[1fr_360px] lg:gap-14">
        <section className="min-w-0">
          <h1 className="mb-5 text-[52px] font-black leading-[0.9] tracking-[-0.045em] sm:text-[88px]">
            Departures tonight
          </h1>
          <p className="mb-9 max-w-[56ch] text-lg">
            Your errands leave while you sleep. Anything that spends money waits at the gate for your OK in the morning.
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="font-mono text-xs text-ink-2">
                <th scope="col" className="w-[110px] border-b-[3px] border-ink pb-3 pr-4 text-left font-bold">Time</th>
                <th scope="col" className="border-b-[3px] border-ink pb-3 pr-4 text-left font-bold">Chore</th>
                <th scope="col" className="border-b-[3px] border-ink pb-3 text-left font-bold max-sm:hidden">Site</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((c) => (
                <tr key={c.id} className="border-b border-line align-top">
                  <td className="py-[18px] pr-4 font-mono text-[26px] font-bold leading-none text-ink-2 max-sm:text-xl">--:--</td>
                  <td className="py-[18px] pr-4">
                    <b className="block text-[19px] font-extrabold leading-tight tracking-[-0.01em]">{c.title}</b>
                    {c.risky && <span className="text-[15px] text-signal-ink">Asks you before paying</span>}
                  </td>
                  <td className="py-[18px] font-mono text-[13px] capitalize text-ink-2 max-sm:hidden">{c.site}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="self-start border-[3px] border-t-[12px] border-ink border-t-signal lg:sticky lg:top-8 max-lg:max-w-[420px]">
          <div className="p-4">
            <h2 className="mb-3 text-[32px] font-black leading-none tracking-[-0.035em]">Sign in to see tonight&rsquo;s board</h2>
            <p className="mb-5 text-ink-2">
              Sign in with the same Auth0 account that gets the Guardian push, so approvals reach your phone.
            </p>
            <a
              href="/auth/login"
              className="flex min-h-[54px] items-center justify-between bg-ink px-4 font-extrabold text-bg transition-colors hover:bg-[#33353a]"
            >
              Sign in
              <SignInIcon size={20} aria-hidden />
            </a>
          </div>
        </aside>
      </main>
    </>
  );
}
