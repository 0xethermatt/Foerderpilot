'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface UserMenuProps {
  userEmail: string;
  companyName: string | null;
  isDemo: boolean;
  signOutAction: () => Promise<void>;
}

export default function UserMenu({ userEmail, companyName, isDemo, signOutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const displayName = companyName ?? userEmail;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors max-w-[180px]"
      >
        <span className="hidden sm:block truncate">{displayName}</span>
        {isDemo && (
          <span className="hidden sm:inline-flex flex-shrink-0 items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            Demo
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50 overflow-hidden">
          {/* Account info */}
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            {companyName && (
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{companyName}</p>
            )}
            <p className={`text-xs text-gray-500 dark:text-gray-400 truncate ${companyName ? 'mt-0.5' : ''}`}>
              {userEmail}
            </p>
            {isDemo && (
              <span className="mt-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                Demo-Umgebung
              </span>
            )}
          </div>

          {/* Theme toggle row */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Darstellung</span>
            <ThemeToggle />
          </div>

          {/* Sign out */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="h-4 w-4 text-gray-400 flex-shrink-0" />
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
