'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CollapsibleCard({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
  id,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">{icon}</span>}
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </div>
        <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
