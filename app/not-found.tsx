import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 text-center">
      <h1 className="font-serif text-4xl">That page is not in the ledger</h1>
      <p className="mt-3 max-w-md text-muted">
        It may have been deleted, or the link is a little off. You can head back
        to your books and keep going.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white"
      >
        Return home
      </Link>
    </div>
  );
}
