import { notFound } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { loadChore } from "@/lib/temporal";
import { Header } from "@/components/header";
import { ApproveView } from "@/components/approve-view";

export default async function Approve({ params }: PageProps<"/approve/[workflowId]">) {
  const { workflowId } = await params;
  const session = await auth0.getSession();
  if (!session) return null; // the proxy already sent you to sign in

  const found = await loadChore(decodeURIComponent(workflowId)).catch(() => null);
  if (!found || (found.night.userSub && found.night.userSub !== session.user.sub)) notFound();

  return (
    <>
      <Header user={session.user} />
      <main className="mx-auto max-w-[440px] px-4 pb-16 pt-6">
        <ApproveView initial={found} />
      </main>
    </>
  );
}
