'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type TaskSummary } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_DOT: Record<string, string> = {
  Low: 'bg-gray-400',
  Medium: 'bg-blue-400',
  High: 'bg-orange-400',
  Critical: 'bg-red-500',
};

interface Props {
  tasks: TaskSummary[];
  projectId: string;
}

export default function CalendarView({ tasks, projectId }: Props) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const firstDay = new Date(year, month, 1).getDay(); // day of week of 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a map: "YYYY-MM-DD" -> TaskSummary[]
  const tasksByDate = new Map<string, TaskSummary[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dateKey = task.dueDate.slice(0, 10);
    if (!tasksByDate.has(dateKey)) tasksByDate.set(dateKey, []);
    tasksByDate.get(dateKey)!.push(task);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Build calendar cells: nulls for leading blank days, then 1..daysInMonth
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="rounded px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          ‹ Prev
        </button>
        <span className="text-base font-semibold text-gray-800">
          {monthName} {year}
        </span>
        <button
          onClick={nextMonth}
          className="rounded px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          Next ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-gray-200">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`blank-${i}`} className="border-r border-b border-gray-200 bg-gray-50 min-h-[80px]" />
            );
          }
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const isToday = dateKey === todayKey;

          return (
            <div
              key={dateKey}
              className={`border-r border-b border-gray-200 p-1.5 min-h-[80px] ${isToday ? 'bg-blue-50' : 'bg-white'}`}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/projects/${projectId}/tasks/${task.id}`)}
                    className="w-full text-left text-xs px-1 py-0.5 rounded bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-1 truncate"
                    title={task.title}
                  >
                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                    <span className="truncate text-gray-700">{task.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-gray-400 pl-1">+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
