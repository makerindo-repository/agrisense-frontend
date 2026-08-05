import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TableHead } from '@/components/ui/table';

export const HelpTableHead = ({
  label,
  help,
  className = '',
}: {
  label: string;
  help: string;
  className?: string;
}) => {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const showTooltip = (event: React.MouseEvent<HTMLSpanElement> | React.FocusEvent<HTMLSpanElement>) => {
    setAnchor(event.currentTarget.getBoundingClientRect());
  };

  return (
    <TableHead className={className}>
      <span
        className="inline-flex cursor-help items-center justify-center gap-1"
        onMouseEnter={showTooltip}
        onMouseLeave={() => setAnchor(null)}
        onFocus={showTooltip}
        onBlur={() => setAnchor(null)}
        tabIndex={0}
      >
        <span>{label}</span>
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border text-[9px] font-black text-muted-foreground">?</span>
      </span>
      {anchor && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-72 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-left text-[11px] font-medium normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl"
          style={{
            left: anchor.left + anchor.width / 2,
            top: anchor.top - 8,
          }}
        >
          {help}
        </div>,
        document.body
      )}
    </TableHead>
  );
};
