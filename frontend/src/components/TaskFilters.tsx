'use client';

import { type TaskPriority, type TaskStatus, type UserRecord } from '@/lib/api';

export interface TaskFilters {
  status: TaskStatus | '';
  priority: TaskPriority | '';
  assigneeId: string;
  dueDate: string;
}

interface Props {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  users?: UserRecord[];
}

const STATUSES: TaskStatus[] = ['ToDo', 'InProgress', 'InReview', 'Done'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];

function statusLabel(s: TaskStatus) {
  if (s === 'ToDo') return 'To Do';
  if (s === 'InProgress') return 'In Progress';
  if (s === 'InReview') return 'In Review';
  return s;
}

export default function TaskFilters({ filters, onChange, users = [] }: Props) {
  function set(patch: Partial<TaskFilters>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        className="border rounded px-2 py-1 text-sm bg-white"
        value={filters.status}
        onChange={e => set({ status: e.target.value as TaskStatus | '' })}
      >
        <option value="">All Statuses</option>
        {STATUSES.map(s => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>

      <select
        className="border rounded px-2 py-1 text-sm bg-white"
        value={filters.priority}
        onChange={e => set({ priority: e.target.value as TaskPriority | '' })}
      >
        <option value="">All Priorities</option>
        {PRIORITIES.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {users.length > 0 && (
        <select
          className="border rounded px-2 py-1 text-sm bg-white"
          value={filters.assigneeId}
          onChange={e => set({ assigneeId: e.target.value })}
        >
          <option value="">All Assignees</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      )}

      <input
        type="date"
        className="border rounded px-2 py-1 text-sm bg-white"
        value={filters.dueDate}
        onChange={e => set({ dueDate: e.target.value })}
        placeholder="Due date filter"
      />

      {(filters.status || filters.priority || filters.assigneeId || filters.dueDate) && (
        <button
          onClick={() => onChange({ status: '', priority: '', assigneeId: '', dueDate: '' })}
          className="text-xs text-gray-500 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
