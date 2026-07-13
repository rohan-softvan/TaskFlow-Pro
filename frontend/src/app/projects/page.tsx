'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { projectsApi, type ProjectStatus, type ProjectSummary } from '@/lib/api';

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Planning: 'bg-slate-100 text-slate-700',
  Active: 'bg-green-100 text-green-700',
  OnHold: 'bg-amber-100 text-amber-700',
  Completed: 'bg-blue-100 text-blue-700',
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status === 'OnHold' ? 'On Hold' : status}
    </span>
  );
}

export default function ProjectsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const canManage = user?.role === 'Admin' || user?.role === 'ProjectManager';

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user?.mustResetPw) router.replace('/change-password');
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const data = await projectsApi.list(showArchived);
      setProjects(data);
      setFetchError('');
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load projects');
    }
  }, [showArchived]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const created = await projectsApi.create({
        name: newName,
        description: newDescription || undefined,
        startDate: newStart || undefined,
        endDate: newEnd || undefined,
      });
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      setNewStart('');
      setNewEnd('');
      router.push(`/projects/${created.id}`);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
            {canManage && (
              <button
                onClick={() => setShowCreate((v) => !v)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + New Project
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {showCreate && canManage && (
          <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">New Project</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            {createError && (
              <p className="mt-3 text-sm text-red-600">{createError}</p>
            )}
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block rounded-xl bg-white p-5 shadow-md transition hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              {p.isArchived && (
                <span className="mt-1 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Archived
                </span>
              )}
              <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                {p.description || 'No description'}
              </p>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Progress</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Owner: {p.owner.fullName}</span>
                <span>{p._count.tasks} task(s)</span>
              </div>
            </Link>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full rounded-xl bg-white p-8 text-center text-gray-400 shadow-md">
              No projects yet.{canManage ? ' Create one to get started.' : ''}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
