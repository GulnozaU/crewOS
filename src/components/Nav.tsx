"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/owner", label: "Owner Dashboard" },
  { href: "/employee", label: "Employee Portal" },
  { href: "/manager", label: "Manager Review" },
  { href: "/agent", label: "Workforce Agent" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-[var(--primary)]">
          CrewOS
        </Link>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                pathname === link.href
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
