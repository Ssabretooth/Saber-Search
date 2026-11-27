"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  FileText,
  Search,
  AlertCircle,
  User,
  Info,
  ScrollText,
  MoreHorizontal,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const sections = [
  { href: "/members",     label: "Parliament",          icon: Users },
  { href: "/disclosures", label: "Disclosures",         icon: FileText },
  { href: "/members",     label: "Follow the Tender",   icon: Search },
  { href: "/flags",       label: "Alerts & Flags",      icon: AlertCircle },
];

const accountLinks = [
  { href: "/profile", label: "Profile",       icon: User },
  { href: "/about",   label: "About",         icon: Info },
  { href: "/terms",   label: "Terms of Use",  icon: ScrollText },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() ?? "?";

  const hideSidebar = ["/login", "/signup", "/auth/callback"].includes(pathname);
  if (hideSidebar) return null;

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-stone-200 bg-[#FAFAF7]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-stone-200 px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="PublikEye" width={28} height={28} className="rounded-md" />
          <span className="text-sm font-semibold text-slate-900">PublikEye</span>
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Explore
        </p>
        <ul className="space-y-0.5">
          {sections.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={label}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                    active
                      ? "bg-teal-50 font-medium text-teal-700"
                      : "text-slate-600 hover:bg-stone-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={15} className={active ? "text-teal-600" : "text-slate-400"} />
                  {label}
                  {active && <ChevronRight size={12} className="ml-auto text-teal-400" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account footer */}
      <div className="border-t border-stone-200 p-2" ref={menuRef}>
        {/* Three-dot menu popup */}
        {menuOpen && (
          <div className="mb-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
            {accountLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-stone-50"
              >
                <Icon size={14} className="text-slate-400" />
                {label}
              </Link>
            ))}
            {user && (
              <>
                <div className="mx-3 my-1 h-px bg-stone-100" />
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    router.replace("/");
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </>
            )}
          </div>
        )}

        {/* Account row */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-stone-100"
        >
          {user ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
              {initials}
            </span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200">
              <User size={13} className="text-slate-500" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-800">
              {profile?.first_name
                ? `${profile.first_name} ${profile.last_name ?? ""}`.trim()
                : user?.email ?? "Account"}
            </p>
            {user && (
              <p className="truncate text-[10px] text-slate-400">{user.email}</p>
            )}
          </div>
          <MoreHorizontal size={14} className="shrink-0 text-slate-400" />
        </button>
      </div>
    </aside>
  );
}
