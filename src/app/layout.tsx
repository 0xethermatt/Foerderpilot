import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Förderpilot',
  description: 'Interne Verwaltung von Wärmepumpen-Förderanträgen',
};

// viewportFit=cover is required for env(safe-area-inset-bottom) to return
// non-zero values on iPhone — without it the safe-area is always 0.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

// Inline script runs before React hydration to prevent dark-mode flash.
const themeScript = `
(function(){
  try{
    var t=localStorage.getItem('fp-theme');
    var d=window.matchMedia('(prefers-color-scheme:dark)').matches;
    if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark');}
  }catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-12 sm:h-14 items-center justify-between gap-4">
                {/* Brand */}
                <div className="flex items-center gap-3">
                  <Link href="/dashboard" className="flex items-center gap-2.5 group">
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                      Förderpilot
                    </span>
                  </Link>
                  <span className="hidden sm:inline-flex text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded px-1.5 py-0.5 font-medium">
                    Interne Förderakte
                  </span>
                </div>

                {/* Nav */}
                <nav className="flex items-center gap-1">
                  <Link
                    href="/dashboard"
                    className="hidden sm:inline-flex items-center rounded-md px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    Übersicht
                  </Link>
                  <Link
                    href="/cases/new"
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Neuer Förderfall</span>
                    <span className="sm:hidden">Neu</span>
                  </Link>
                  <ThemeToggle />
                </nav>
              </div>
            </div>
          </header>

          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:pb-8">
            {children}
          </main>

          <footer className="border-t border-gray-200 dark:border-gray-800 py-4">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="text-xs text-gray-400 dark:text-gray-600">
                Förderpilot unterstützt die Vorbereitung von Förderanträgen. Kein automatischer Antrag –
                alle KI-Prüfungen erfordern manuelle Freigabe. Keine Garantie auf Fördererhalt.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
