'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type TaskPriority, type TaskStatus, type TaskSummary } from '@/lib/api';

type SortKey = 'title' | 'priority' | 'status' | 'dueDate' | 'assignee';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<TaskPriority, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };
const STATUS_ORDER: Record<TaskStatus, number> = { ToDo: 0, InProgress: 1, InReview: 2, Done: 3 };

const STATUS_STYLES: Record<TaskStatus, string> = {
  ToDo: 'bg-gray-100 text-gray-700',
  InProgress: 'bg-blue-100 text-blue-700',
  InReview: 'bg-amber-100 text-amber-700',
  Done: 'bg-green-100 text-green-700',
};

const STATUSES: TaskStatus[] = ['ToDo', 'InProgress', 'InReview', 'Done'];

function statusLabel(s: TaskStatus) {
  if (s === 'ToDo') return 'To Do';
  if (s === 'InProgress') return 'In Progress';
  if (s === 'InReview') return 'In Review';
  return s;
}

function nextStatus(s: TaskStatus): TaskStatus {
  const idx = STATUSES.indexOf(s);
  return STATUSES[(idx + 1) % STATUSES.length];
}

interface Props {
  tasks: TaskSummary[];
  projectId: string;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
}

export default function ListViewComponent({ tasks, projectId, onStatusChange }: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
    else if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    else if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    else if (sortKey === 'dueDate') {
      const ad = a.dueDate ?? '';
      const bd = b.dueDate ?? '';
      cmp = ad.localeCompare(bd);
    } else if (sortKey === 'assignee') {
      cmp = (a.assignee?.fullName ?? '').localeCompare(b.assignee?.fullName ?? '');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none hover:text-gray-900"
        onClick={() => handleSort(col)}
      >
        {label}
        {active && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    );
  }

  async function handleToggleStatus(task: TaskSummary) {
    if (togglingId) return;
    setTogglingId(task.id);
    try {
      await onStatusChange(task.id, nextStatus(task.status));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <SortHeader col="title" label="Title" />
            <SortHeader col="status" label="Status" />
            <SortHeader col="priority" label="Priority" />
            <SortHeader col="assignee" label="Assignee" />
            <SortHeader col="dueDate" label="Due Date" />
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Subtasks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sorted.map(task => (
            <tr key={task.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 max-w-xs">
                <button
                  onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
                  className="text-left font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-1"
                >
                  {task.title}
                </button>
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={() => handleToggleStatus(task)}
                  disabled={togglingId === task.id}
                  title="Click to advance status"
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 ${STATUS_STYLES[task.status]}`}
                >
                  {statusLabel(task.status)}
                </button>
              </td>
              <td className="px-3 py-2.5 text-xs text-gray-600">{task.priority}</td>
              <td className="px-3 py-2.5 text-xs text-gray-600">
                {task.assignee?.fullName ?? <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-gray-500">
                {task.dueDate ? task.dueDate.slice(0, 10) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-gray-500">
                {task._count.subtasks > 0 ? task._count.subtasks : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                No tasks match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
