"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DumbbellIcon, HistoryIcon, TrendIcon } from "./icons";

const TABS = [
  { href: "/", label: "Train", Icon: DumbbellIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/progress", label: "Progress", Icon: TrendIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-line-soft bg-bg"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)", paddingTop: "6px" }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${
                active ? "text-volt" : "text-faint hover:text-muted"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
              <span className="display text-[11px] font-semibold uppercase tracking-[0.14em]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
