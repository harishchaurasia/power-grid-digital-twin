import type { ReactNode } from "react";

/**
 * Elevated console panel. Brand rules live here so callers can't drift:
 * 4px radius, 1px border, elevation by surface colour only -- no shadows,
 * no gradients (docs/brand.md).
 */
export interface PanelProps {
  title: string;
  /** Named model or standard behind the numbers in this panel. */
  standard?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, standard, actions, children, className = "" }: PanelProps) {
  return (
    // shrink-0: the side rails are `overflow-y-auto` flex columns, so without it
    // flexbox compresses the section box while its content keeps its natural
    // height and spills past the border onto the panel below. Rails scroll.
    <section
      className={`flex shrink-0 flex-col rounded border border-border bg-surface-1/95 backdrop-blur-sm ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[20px] tracking-[0.03em] text-text-primary">{title}</h2>
          {standard ? (
            <span
              className="font-mono text-[11px] text-text-tertiary"
              title="Model or standard behind every number in this panel"
            >
              {standard}
            </span>
          ) : null}
        </div>
        {actions}
      </header>
      <div className="flex-1 px-4 py-3">{children}</div>
    </section>
  );
}

export interface CaptionProps {
  children: ReactNode;
  className?: string;
}

export function Caption({ children, className = "" }: CaptionProps) {
  return (
    <span
      className={`text-[12px] font-medium uppercase tracking-[0.05em] text-text-tertiary ${className}`}
    >
      {children}
    </span>
  );
}
