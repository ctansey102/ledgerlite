import Link from "next/link";

export function EmptyState({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-paper px-6 py-10 text-center">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-flex rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white hover:bg-forest-dark"
      >
        {action}
      </Link>
    </div>
  );
}
