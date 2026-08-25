import type { Metadata } from "next";
import { IBM_Plex_Mono, Vazirmatn } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spec Hub",
  description:
    "نگارش مشخصات Agent-Ready با روابط تایپ‌شده و انتشار در BookStack.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang='fa'
      dir='rtl'
      className={`${vazirmatn.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className='flex min-h-full flex-col bg-grid'>
        <header className='border-b border-border/80 bg-surface-elevated/80 backdrop-blur-md'>
          <div className='mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6'>
            <Link href='/' className='group block'>
              <p className='font-display text-2xl font-semibold tracking-tight text-accent-ink sm:text-3xl'>
                Spec Hub
              </p>
              <p className='text-xs text-muted group-hover:text-foreground'>
                پرتال مشخصات آماده برای ایجنت
              </p>
            </Link>
            <nav className='flex items-center gap-3 text-sm'>
              <Link
                href='/specs/new'
                className='rounded-md bg-accent px-3 py-2 font-semibold text-white transition hover:bg-accent-ink'
              >
                مشخصات جدید
              </Link>
            </nav>
          </div>
        </header>
        <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6'>
          {children}
        </main>
      </body>
    </html>
  );
}
