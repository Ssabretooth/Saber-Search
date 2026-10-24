import Link from "next/link";
import Image from "next/image";
import { User, FileText, TrendingUp, Gavel, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const categories = [
  {
    id: "members",
    title: "Members of Parliament",
    description: "Explore profiles of all members",
    icon: User,
    href: "/members",
  },
  {
    id: "disclosures",
    title: "Financial Disclosures",
    description: "Track declared interests and assets",
    icon: FileText,
    href: "/disclosures",
  },
  {
    id: "spending",
    title: "State Spending",
    description: "Government expenditure allocation",
    icon: TrendingUp,
    href: "/spending",
  },
  {
    id: "judicial",
    title: "Judicial Proceedings",
    description: "Legal matters and court cases",
    icon: Gavel,
    href: "/judicial",
  },
  {
    id: "flags",
    title: "Alerts & Flags",
    description: "Notable patterns and observations",
    icon: AlertCircle,
    href: "/flags",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          {/* Logo (top left) */}
          <div className="flex items-center gap-3 w-32">
            <Image
              src="/logo.jpg"
              alt="PublikEye"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-sm font-semibold text-slate-900">PublikEye</span>
          </div>

          {/* Title (center) */}
          <h1 className="text-2xl font-bold text-slate-900 flex-1 text-center">
            Transparency Matters
          </h1>

          {/* Avatar (top right) */}
          <div className="w-32 flex justify-end">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-600 rounded-full flex items-center justify-center text-white">
              <User size={20} />
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <section className="bg-gradient-to-r from-teal-50 to-blue-50 border-b">
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Welcome to PublikEye
          </h2>
          <p className="text-lg text-slate-700 leading-relaxed max-w-2xl mx-auto">
            We believe in <span className="font-semibold">open democracy</span> and <span className="font-semibold">accountability</span>.
            PublikEye tracks how state resources and public funds are used by members of parliament.
            All information here is <span className="font-semibold">publicly available</span>—we simply bring it together in one place,
            respecting privacy while promoting transparency.
            Explore, learn, and stay informed about how your government works.
          </p>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="container mx-auto max-w-6xl px-4 py-16">
        <h3 className="text-xl font-semibold text-slate-900 mb-8">Explore Data</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                href={cat.href}
                className="group p-6 bg-white border rounded-lg hover:border-teal-400 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col gap-3 h-full">
                  <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <Icon className="text-teal-600" size={24} />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-900 group-hover:text-teal-600 transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-xs text-slate-600">{cat.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-slate-50 mt-16">
        <div className="container mx-auto max-w-6xl px-4 py-8 text-center text-sm text-slate-600">
          <p>PublikEye — Transparency for accountable governance</p>
        </div>
      </footer>
    </div>
  );
}
