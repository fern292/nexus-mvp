import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
  { href: "/wallets", label: "Wallets" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-900">
      <div className="border-b border-gray-800 p-6">
        <h1 className="text-xl font-bold text-white">Nexus</h1>
        <p className="text-sm text-gray-400">Portfolio Tracker</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
