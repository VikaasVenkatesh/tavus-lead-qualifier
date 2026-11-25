import type { Metadata } from "next";
import { Inter, Jost, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { COMPANY } from "@/lib/tavus-config";
import "./globals.css";

const jost = Jost({ variable: "--font-jost", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `Talk to a dispatcher | ${COMPANY.name}`,
  description: "Spearflow Lead Qualifier: an AI human (Tavus CVI) that qualifies HVAC leads face to face and books the visit live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jost.variable} ${inter.variable} ${mono.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-5 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3.2" fill="#C4470A" stroke="none" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[17px] font-semibold tracking-tight text-ink">{COMPANY.short}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Heating &amp; Cooling · KC</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-full px-3 py-2 text-body hover:text-ink">Dispatcher</Link>
            <Link href="/leads" className="rounded-full px-3 py-2 text-body hover:text-ink">Leads</Link>
            <a href={`tel:${COMPANY.phone.replace(/\D/g, "")}`} className="ml-2 hidden rounded-full border border-line bg-white px-3.5 py-2 font-semibold text-ink sm:inline-flex">
              {COMPANY.phone}
            </a>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-[1320px] px-4 py-8 text-sm text-muted md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <p>
              <span className="font-semibold text-ink">Spearflow Lead Qualifier</span> · demo built on Tavus CVI. {COMPANY.name} is a fictional company.
            </p>
            <a className="hover:text-ink" href="https://github.com/VikaasVenkatesh/tavus-lead-qualifier">Source on GitHub →</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
