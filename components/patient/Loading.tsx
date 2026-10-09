/** Calm loading line: static text, no spinner, announced once. */
export function Loading() {
  return (
    <p role="status" className="rounded-2xl border-2 border-line-strong bg-sand px-5 py-6 text-p-body text-ink-soft">
      Un momento…
    </p>
  );
}
