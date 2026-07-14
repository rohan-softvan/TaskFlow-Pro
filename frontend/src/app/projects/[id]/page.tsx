'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import {
  projectsApi,
  tasksApi,
  usersApi,
  type ProjectDetail,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
  type TaskSummary,
  type UserRecord,
} from '@/lib/api';

const TASK_STATUS_OPTIONS: TaskStatus[] = ['ToDo', 'InProgress', 'InReview', 'Done'];
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  ToDo: 'bg-gray-100 text-gray-700',
  InProgress: 'bg-blue-100 text-blue-700',
  InReview: 'bg-amber-100 text-amber-700',
  Done: 'bg-green-100 text-green-700',
};

function taskStatusLabel(s: TaskStatus) {
  if (s === 'ToDo') return 'To Do';
  if (s === 'InProgress') return 'In Progress';
  if (s === 'InReview') return 'In Review';
  return s;
}

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

  // Tasks
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('ToDo');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('Medium');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');

  const canManage = user?.role === 'Admin' || user?.role === 'ProjectManager';
  const readOnly = project?.isArchived ?? false;

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const [data, taskList] = await Promise.all([
        projectsApi.get(id),
        tasksApi.list(id).catch(() => [] as TaskSummary[]),
      ]);
      setProject(data);
      setTasks(taskList);
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

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await tasksApi.create(id, {
        title: newTaskTitle.trim(),
        status: newTaskStatus,
        priority: newTaskPriority,
        assigneeId: newTaskAssigneeId || undefined,
      });
      setNewTaskTitle('');
      setNewTaskStatus('ToDo');
      setNewTaskPriority('Medium');
      setNewTaskAssigneeId('');
      setShowCreateTask(false);
      setActionMsg('Task created.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to create task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await tasksApi.remove(id, taskId);
      setActionMsg('Task deleted.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to delete task');
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

        {/* Tasks */}
        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Tasks ({tasks.length})
            </h2>
            {!readOnly && (
              <button
                onClick={() => setShowCreateTask((v) => !v)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showCreateTask ? 'Cancel' : '+ New Task'}
              </button>
            )}
          </div>

          {showCreateTask && (
            <form onSubmit={handleCreateTask} className="mb-4 rounded-lg border border-gray-200 p-4">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Task title"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                >
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{taskStatusLabel(s)}</option>
                  ))}
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                >
                  {TASK_PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {project.members.length > 0 && (
                  <select
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {project.members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.user.fullName}</option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_STYLES[t.status]}`}
                    >
                      {taskStatusLabel(t.status)}
                    </span>
                    <span className="text-xs text-gray-400">{t.priority}</span>
                    <button
                      onClick={() => router.push(`/projects/${id}/tasks/${t.id}`)}
                      className="truncate text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline text-left"
                    >
                      {t.title}
                    </button>
                  </div>
                  {t.assignee && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      Assigned to {t.assignee.fullName}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.dueDate && (
                    <span className="text-xs text-gray-400">{t.dueDate.slice(0, 10)}</span>
                  )}
                  <button
                    onClick={() => router.push(`/projects/${id}/tasks/${t.id}`)}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  >
                    View
                  </button>
                  {(canManage || t.createdBy === user?.id || t.assigneeId === user?.id) && !readOnly && (
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-400">No tasks yet.</li>
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
