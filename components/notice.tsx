export function Notice({
  message,
  tone = "error",
}: {
  message?: string | string[];
  tone?: "error" | "success";
}) {
  if (!message) return null;
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;

  const friendly =
    text === "check-email"
      ? "Check your email for a confirmation link. After you open it, come back here and sign in with the same password."
      : text === "confirmed"
        ? "Your email is confirmed. Sign in with the password you created."
        : text;

  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm ${
        tone === "success" || text === "check-email" || text === "confirmed"
          ? "bg-sage text-forest-dark"
          : "bg-red-50 text-danger"
      }`}
    >
      {friendly}
    </p>
  );
}
