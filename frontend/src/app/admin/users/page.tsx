'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { usersApi, type UserRecord, type UserRole } from '@/lib/api';

const ROLES: UserRole[] = ['Admin', 'ProjectManager', 'Member', 'Viewer'];

export default function AdminUsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Member');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState('');

  useEffect(() => {
    if (!isLoading && !user) { router.replace('/login'); return; }
    if (!isLoading && user && user.role !== 'Admin') { router.replace('/dashboard'); return; }
  }, [isLoading, user, router]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
      setFetchError('');
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'Admin') loadUsers();
  }, [user, loadUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateResult('');
    try {
      const created = await usersApi.create({ email: newEmail, fullName: newFullName, role: newRole });
      setCreateResult(`Created! Temp password: ${created.tempPassword}`);
      setNewEmail('');
      setNewFullName('');
      setNewRole('Member');
      setShowCreate(false);
      await loadUsers();
    } catch (e: unknown) {
      setCreateResult(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await usersApi.deactivate(id);
      setActionMsg('User deactivated.');
      await loadUsers();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleResetPassword(id: string) {
    try {
      const { tempPassword } = await usersApi.resetPassword(id);
      setActionMsg(`Temp password: ${tempPassword}`);
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleRoleChange(id: string, role: UserRole) {
    try {
      await usersApi.update(id, { role });
      setActionMsg('Role updated.');
      await loadUsers();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add User
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {actionMsg}{' '}
            <button onClick={() => setActionMsg('')} className="ml-2 text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {createResult && (
          <div className="mb-4 rounded-md bg-green-50 px-4 py-3 font-mono text-sm text-green-800">
            {createResult}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-xl bg-white p-6 shadow-md"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Create User</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {fetchError && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        <div className="overflow-hidden rounded-xl bg-white shadow-md">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.fullName}</div>
                    <div className="text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.id === user.userId ? (
                      <span className="text-gray-500">{u.role}</span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {u.mustResetPw && (
                      <span className="ml-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Must Reset
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Reset PW
                      </button>
                      {u.isActive && u.id !== user.userId && (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
