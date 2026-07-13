'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { AppHeader } from '@/components/AppHeader';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user?.mustResetPw) router.replace('/change-password');
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-2xl p-8">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h1 className="text-xl font-bold text-gray-900">
            Welcome to TaskFlow Pro
          </h1>
          <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800">Projects</h2>
          <p className="mt-2 text-sm text-gray-500">
            View and manage the projects you belong to.
          </p>
          <Link
            href="/projects"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Go to Projects →
          </Link>
          <p className="mt-3 text-xs text-gray-400">Role: {user.role}</p>
        </div>

        {user.role === 'Admin' && (
          <div className="mt-4 rounded-xl bg-white p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-800">Admin</h2>
            <Link
              href="/admin/users"
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              Manage Users →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
