'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { profileApi } from '@/lib/api';
import { Avatar } from './Avatar';

/**
 * Global app header (Wireframe §1/§12): brand + avatar dropdown
 * (Profile, Change password, Logout). Avatar reflects the uploaded image.
 */
export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    profileApi
      .getMe()
      .then((p) => setFullName(p.fullName))
      .catch(() => setFullName(null));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-bold text-gray-900">
          TaskFlow Pro
        </Link>
        <nav className="hidden items-center gap-4 sm:flex">
          {(user?.role === 'Admin' || user?.role === 'ProjectManager') && (
            <Link
              href="/dashboard/executive"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/projects"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Projects
          </Link>
          {user?.role === 'Admin' && (
            <Link
              href="/admin/users"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Avatar fullName={fullName ?? user?.email} size={36} />
          <span className="text-gray-400">▾</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
              {user?.email}
            </div>
            <Link
              href="/profile"
              role="menuitem"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <Link
              href="/change-password"
              role="menuitem"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Change password
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
