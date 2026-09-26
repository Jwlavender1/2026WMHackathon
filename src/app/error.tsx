'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>We couldn’t load this page.</h1>
      <p>Please check your connection and try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
