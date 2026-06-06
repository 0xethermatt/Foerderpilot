import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Förderpilot',
  description: 'Interne Verwaltung von Wärmepumpen-Förderanträgen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-14 items-center gap-3">
                <span className="text-lg font-semibold text-gray-900 tracking-tight">
                  Förderpilot
                </span>
                <span className="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-medium">
                  MVP
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
