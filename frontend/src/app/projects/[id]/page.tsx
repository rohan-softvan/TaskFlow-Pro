'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import {
  projectsApi,
  usersApi,
  type ProjectDetail,
  type ProjectStatus,
  type UserRecord,
} from '@/lib/api';

const STATUSES: ProjectStatus[] = ['Planning', 'Active', 'OnHold', 'Completed'];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  Planning: 'bg-slate-100 text-slate-700',
  Active: 'bg-green-100 text-green-700',
  OnHold: 'bg-amber-100 text-amber-700',
  Completed: 'bg-blue-100 text-blue-700',
};

function label(s: ProjectStatus) {
  return s === 'OnHold' ? 'On Hold' : s;
}

export default function ProjectDetailPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Add-member UI (admins can list all users; PMs pick by id/email match)
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [addUserId, setAddUserId] = useState('');

  const canManage = user?.role === 'Admin' || user?.role === 'ProjectManager';
  const readOnly = project?.isArchived ?? false;

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const data = await projectsApi.get(id);
      setProject(data);
      setFetchError('');
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load project');
    }
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Admin can enumerate users for the member picker; PMs paste a user id.
  useEffect(() => {
    if (user?.role === 'Admin') {
      usersApi.list().then(setAllUsers).catch(() => setAllUsers([]));
    }
  }, [user]);

  async function handleStatus(status: ProjectStatus) {
    try {
      await projectsApi.changeStatus(id, status);
      setActionMsg(`Status changed to ${label(status)}.`);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleArchive(archive: boolean) {
    try {
      await projectsApi.setArchived(id, archive);
      setActionMsg(archive ? 'Project archived.' : 'Project restored.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserId) return;
    try {
      await projectsApi.addMember(id, addUserId);
      setAddUserId('');
      setActionMsg('Member added.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to add member');
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await projectsApi.removeMember(id, userId);
      setActionMsg('Member removed.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
          <button
            onClick={() => router.push('/projects')}
            className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            ← Back to Projects
          </button>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  const memberIds = new Set(project.members.map((m) => m.userId));
  const addableUsers = allUsers.filter(
    (u) => u.isActive && !memberIds.has(u.id),
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push('/projects')}
          className="mb-4 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          ← Projects
        </button>

        {actionMsg && (
          <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {actionMsg}{' '}
            <button onClick={() => setActionMsg('')} className="ml-2 text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Header (Wireframe 4) */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[project.status]}`}
                >
                  {label(project.status)}
                </span>
                {project.isArchived && (
                  <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Archived (read-only)
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {project.description || 'No description'}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                <span>Owner: {project.owner.fullName}</span>
                <span>Start: {project.startDate?.slice(0, 10) || '—'}</span>
                <span>End: {project.endDate?.slice(0, 10) || '—'}</span>
                <span>{project._count.tasks} task(s)</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Management controls */}
          {canManage && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={project.status}
                disabled={readOnly}
                onChange={(e) => handleStatus(e.target.value as ProjectStatus)}
                className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </select>
              {project.isArchived ? (
                <button
                  onClick={() => handleArchive(false)}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => handleArchive(true)}
                  className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Archive
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Members ({project.members.length})
          </h2>

          {canManage && !readOnly && (
            <form onSubmit={handleAddMember} className="mb-4 flex flex-wrap gap-2">
              {user.role === 'Admin' ? (
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="min-w-[240px] rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select a user…</option>
                  {addableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="User ID to add"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="min-w-[240px] rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              )}
              <button
                type="submit"
                disabled={!addUserId}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add Member
              </button>
            </form>
          )}

          <ul className="divide-y">
            {project.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {m.user.fullName}
                    {m.userId === project.ownerId && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {m.user.email} · {m.user.role}
                  </div>
                </div>
                {canManage && !readOnly && m.userId !== project.ownerId && (
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {project.members.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-400">No members.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
