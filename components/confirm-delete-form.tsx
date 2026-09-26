"use client";

export function ConfirmDeleteForm({
  action,
  fields,
  message,
  label = "Delete",
  variant = "text",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
  label?: string;
  variant?: "text" | "button";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        aria-label={label}
        className={
          variant === "button"
            ? "rounded-full border border-line px-4 py-2 text-sm text-danger hover:border-danger"
            : "text-sm text-danger hover:underline"
        }
      >
        Delete
      </button>
    </form>
  );
}
