import { AppShell } from "@/components/app-shell";
import { JournalForm } from "@/components/journal-form";
import { getAccounts, getProfile, requireUser } from "@/lib/data";

export default async function NewJournalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;
  const [profile, accounts] = await Promise.all([
    getProfile(user.id),
    getAccounts(user.id),
  ]);

  return (
    <AppShell name={profile?.display_name ?? "Bookkeeper"} role={profile?.role}>
      <h1 className="font-serif text-4xl">New journal entry</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Debits on the left, credits on the right. If you record a $1,200 client
        payment, debit Cash and credit Service Revenue for the same amount.
      </p>
      <div className="mt-8">
        <JournalForm accounts={accounts} error={error} />
      </div>
    </AppShell>
  );
}
