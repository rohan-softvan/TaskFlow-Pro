'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { tasksApi, type TaskSummary, type TaskStatus } from '@/lib/api';

const STATUS_STYLES: Record<TaskStatus, string> = {
  ToDo: 'bg-gray-100 text-gray-700',
  InProgress: 'bg-blue-100 text-blue-700',
  InReview: 'bg-amber-100 text-amber-700',
  Done: 'bg-green-100 text-green-700',
};

function statusLabel(s: TaskStatus) {
  if (s === 'ToDo') return 'To Do';
  if (s === 'InProgress') return 'In Progress';
  if (s === 'InReview') return 'In Review';
  return s;
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: 'text-gray-500',
  Medium: 'text-blue-600',
  High: 'text-orange-500',
  Critical: 'text-red-600 font-semibold',
};

export default function MyTasksPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    tasksApi
      .myTasks()
      .then(setTasks)
      .catch(e => setFetchError(e instanceof Error ? e.message : 'Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [user]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  // Group by due date bucket: overdue, today, upcoming, no date
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const overdue: TaskSummary[] = [];
  const today: TaskSummary[] = [];
  const upcoming: TaskSummary[] = [];
  const noDate: TaskSummary[] = [];
  const done: TaskSummary[] = [];

  for (const t of tasks) {
    if (t.status === 'Done') { done.push(t); continue; }
    if (!t.dueDate) { noDate.push(t); continue; }
    const d = t.dueDate.slice(0, 10);
    if (d < todayStr) overdue.push(t);
    else if (d === todayStr) today.push(t);
    else upcoming.push(t);
  }

  function TaskRow({ task }: { task: TaskSummary }) {
    return (
      <li className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}>
              {statusLabel(task.status)}
            </span>
            <span className={`text-xs ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
            <button
              onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
              className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline text-left truncate"
            >
              {task.title}
            </button>
          </div>
          {task.dueDate && (
            <div className="mt-0.5 text-xs text-gray-400">Due {task.dueDate.slice(0, 10)}</div>
          )}
        </div>
        <button
          onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
          className="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
        >
          View
        </button>
      </li>
    );
  }

  function Section({ title, items, emptyMsg, accent }: {
    title: string;
    items: TaskSummary[];
    emptyMsg?: string;
    accent?: string;
  }) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-md">
        <h2 className={`mb-3 text-sm font-bold uppercase tracking-wide ${accent ?? 'text-gray-600'}`}>
          {title} <span className="ml-1 text-xs font-normal">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          emptyMsg && <p className="text-sm text-gray-400">{emptyMsg}</p>
        ) : (
          <ul>
            {items.map(t => <TaskRow key={t.id} task={t} />)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <button
            onClick={() => router.push('/projects')}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            ← Projects
          </button>
        </div>

        {fetchError && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{fetchError}</div>
        )}

        {loading ? (
          <p className="text-center text-gray-400">Loading tasks…</p>
        ) : (
          <div className="space-y-4">
            <Section title="Overdue" items={overdue} emptyMsg="No overdue tasks." accent="text-red-600" />
            <Section title="Due Today" items={today} emptyMsg="Nothing due today." accent="text-amber-600" />
            <Section title="Upcoming" items={upcoming} emptyMsg="No upcoming tasks." />
            <Section title="No Due Date" items={noDate} />
            <Section title="Done" items={done} emptyMsg="No completed tasks." accent="text-green-600" />
          </div>
        )}

        {!loading && tasks.length === 0 && !fetchError && (
          <p className="mt-8 text-center text-gray-400">No tasks assigned to you yet.</p>
        )}
      </div>
    </main>
  );
}
