"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const sections = [
  { href: "/members",     label: "Parliament",        icon: Users },
  { href: "/disclosures", label: "Disclosures",       icon: FileText },
  { href: "/tenders",     label: "Follow the Tender", icon: Search },
  { href: "/flags",       label: "Alerts & Flags",    icon: AlertCircle },
];

const accountLinks = [
  { href: "/profile", label: "Profile",      icon: User },
  { href: "/about",   label: "About",        icon: Info },
  { href: "/terms",   label: "Terms of Use", icon: ScrollText },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading || !user) return null;

  const initials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : user.email?.[0]?.toUpperCase() ?? "?";

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex h-screen shrink-0 flex-col border-r border-stone-200 bg-[#FAFAF7] transition-all duration-200 ${
          collapsed ? "w-14" : "w-52"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center border-b border-stone-200 px-3 py-4 gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image src="/logo.jpg" alt="PublikEye" width={26} height={26} className="rounded-md shrink-0" />
            {!collapsed && (
              <span className="text-sm font-semibold text-slate-900 truncate">PublikEye</span>
            )}
          </Link>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`ml-auto shrink-0 rounded-md p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-700 transition-colors ${collapsed ? "mx-auto" : ""}`}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {!collapsed && (
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Explore
            </p>
          )}
          <ul className="space-y-0.5">
            {sections.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={label}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      active
                        ? "bg-teal-50 font-medium text-teal-700"
                        : "text-slate-600 hover:bg-stone-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={15} className={active ? "text-teal-600" : "text-slate-400"} />
                    {!collapsed && (
                      <>
                        {label}
                        {active && <ChevronRight size={11} className="ml-auto text-teal-400" />}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Account footer */}
        <div className="border-t border-stone-200 p-2" ref={menuRef}>
          {menuOpen && (
            <div className={`mb-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg ${collapsed ? "absolute bottom-16 left-14 w-44 z-50" : ""}`}>
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
            </div>
          )}

          <button
            onClick={() => setMenuOpen((o) => !o)}
            title={collapsed ? (fullName || user.email || "Account") : undefined}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-stone-100 ${collapsed ? "justify-center" : ""}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
              {initials}
            </span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">{fullName || user.email}</p>
                  {fullName && <p className="truncate text-[10px] text-slate-400">{user.email}</p>}
                </div>
                <MoreHorizontal size={14} className="shrink-0 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex border-t border-stone-200 bg-[#FAFAF7] md:hidden">
        {sections.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                active ? "text-teal-600" : "text-slate-400"
              }`}
            >
              <Icon size={20} />
              <span>{label.split(" ")[0]}</span>
            </Link>
          );
        })}

        {/* Account tab */}
        <div className="relative flex flex-1 flex-col items-center" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={`flex flex-1 w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
              menuOpen ? "text-teal-600" : "text-slate-400"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[9px] font-bold text-white">
              {initials}
            </span>
            <span>Account</span>
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
              {accountLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-700 hover:bg-stone-50"
                >
                  <Icon size={14} className="text-slate-400" />
                  {label}
                </Link>
              ))}
              <div className="mx-4 my-1 h-px bg-stone-100" />
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  router.replace("/");
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
