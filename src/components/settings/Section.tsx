export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}
