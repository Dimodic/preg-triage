"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, BookOpen, FolderClock, Info, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { useCommandCenter } from "@/contexts/command-center";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/triage", label: "Рабочий экран", icon: Activity },
  { href: "/cases", label: "Обращения", icon: FolderClock },
  { href: "/quality", label: "Качество", icon: BarChart3 },
  { href: "/kb", label: "База знаний", icon: BookOpen },
  { href: "/settings", label: "Настройки", icon: Settings2 },
  { href: "/about", label: "О системе", icon: Info },
];

export function TopNav() {
  const pathname = usePathname();
  const { open } = useCommandCenter();

  return (
    <header className="sticky top-0 z-40 border-b border-border/90 bg-surface-1/75 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/triage" className="font-display text-sm font-semibold tracking-[0.16em] text-foreground">
            {APP_NAME}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                    active && "bg-primary/15 text-primary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden h-9 gap-2 text-xs md:inline-flex" onClick={open}>
            Палитра команд
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Ctrl/⌘ K
            </span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
