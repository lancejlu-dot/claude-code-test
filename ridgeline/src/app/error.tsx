"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <h1 className="text-3xl text-forest-950">Something went wrong</h1>
      <p className="mt-3 text-muted">Please try again. If it keeps happening, let us know.</p>
      <button onClick={reset} className="btn-primary mt-8">Try again</button>
    </div>
  );
}
