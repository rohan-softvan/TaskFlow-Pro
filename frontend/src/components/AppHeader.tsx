'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { notificationsApi, NotificationRecord, profileApi } from '@/lib/api';
import { Avatar } from './Avatar';
import { SearchOverlay } from './SearchOverlay';

/**
 * Global app header (Wireframe §1/§12): brand + avatar dropdown
 * (Profile, Change password, Logout). Avatar reflects the uploaded image.
 */
export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications(data);
    } catch {
      // silently ignore if not authenticated yet
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const id = setInterval(loadNotifications, 30_000);
    return () => clearInterval(id);
  }, [user, loadNotifications]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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
    <>
    {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
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
          <Link
            href="/my-tasks"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            My Tasks
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

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-full p-1.5 hover:bg-gray-100"
            title="Notifications"
            aria-label="Notifications"
          >
            <span className="text-lg leading-none">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <span className="text-sm font-medium text-gray-700">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={async () => {
                      await notificationsApi.markAllRead();
                      await loadNotifications();
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 ${n.isRead ? 'bg-white' : 'bg-blue-50'} border-b border-gray-100 last:border-b-0`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{n.message}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!n.isRead && (
                        <button
                          type="button"
                          className="shrink-0 text-xs text-blue-600 hover:underline"
                          onClick={async () => {
                            await notificationsApi.markRead(n.id);
                            await loadNotifications();
                          }}
                        >
                          Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          title="Search (⌘K)"
        >
          <span>🔍</span>
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded bg-gray-200 px-1 text-xs sm:inline">⌘K</kbd>
        </button>
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
      </div>
    </header>
    </>
  );
}
