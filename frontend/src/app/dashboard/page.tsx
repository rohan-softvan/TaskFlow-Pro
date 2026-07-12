'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow-md">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome to TaskFlow Pro
            </h1>
            <p className="mt-1 text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Logout
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your projects and tasks will appear here in a future slice.
          </p>
        </div>
      </div>
    </main>
  );
}
