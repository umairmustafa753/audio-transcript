import { Fragment } from "react";

/**
 * Wrap every occurrence of `query` in a <mark> without reaching for
 * dangerouslySetInnerHTML — transcript text is arbitrary and untrusted.
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let key = 0;
  let cursor = 0;

  for (;;) {
    const at = lower.indexOf(needle, cursor);
    if (at === -1) break;
    if (at > cursor) parts.push(<Fragment key={key++}>{text.slice(cursor, at)}</Fragment>);
    parts.push(
      <mark
        key={key++}
        className="rounded-[3px] bg-active-soft px-0.5 text-active shadow-[0_0_0_1px_var(--active-line)]"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
  }
  parts.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);

  return <>{parts}</>;
}
