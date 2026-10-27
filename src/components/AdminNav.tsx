'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/polls', label: 'Polls' },
    { href: '/admin/polls/new', label: 'Create Poll' },
  ];

  return (
    <nav className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/admin" className="flex items-center space-x-3">
              <div className="bg-white rounded px-3 py-1">
                <Image
                  src="/logo.png"
                  alt="Liberty Surveys"
                  width={160}
                  height={48}
                  className="h-10 w-auto"
                />
              </div>
              <span className="text-sm font-medium text-gray-400">Admin</span>
            </Link>
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-[#0066b3] text-white'
                      : 'text-gray-300 hover:bg-[#0066b3]/80 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-gray-300 hover:text-white text-sm"
              target="_blank"
            >
              View Site →
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#e31c23]/80 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
