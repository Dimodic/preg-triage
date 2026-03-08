import { TopNav } from "@/components/top-nav";
import { GlobalCommandPalette } from "@/components/global-command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-ambient" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-noise opacity-25" />
      <TopNav />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">{children}</main>
      <GlobalCommandPalette />
    </div>
  );
}
