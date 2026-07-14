'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { AppHeader } from '@/components/AppHeader';
import { dashboardApi, ExecutiveDashboardResponse } from '@/lib/api';

type RagColor = 'Green' | 'Amber' | 'Red';

const RAG_COLORS: Record<RagColor, string> = {
  Green: 'bg-green-500',
  Amber: 'bg-amber-400',
  Red: 'bg-red-500',
};

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function RagDot({ color }: { color: RagColor }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${RAG_COLORS[color]}`}
    />
  );
}

function WorkloadBar({
  name,
  count,
  max,
}: {
  name: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 truncate text-sm text-gray-700">{name}</span>
      <div className="flex-1 rounded-full bg-gray-100">
        <div
          className="h-5 rounded-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-sm font-medium text-gray-700">
        {count}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mb-6 flex gap-4">
          <div className="h-28 flex-1 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-28 flex-1 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-28 flex-1 animate-pulse rounded-xl bg-gray-200" />
        </div>
        <div className="flex gap-6">
          <div className="h-64 flex-1 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-64 flex-1 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </main>
    </div>
  );
}

function Forbidden() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-2xl p-8 text-center">
        <div className="rounded-xl bg-white p-8 shadow-md">
          <h1 className="text-2xl font-bold text-gray-900">403 Forbidden</h1>
          <p className="mt-2 text-gray-500">
            You do not have permission to access the Executive Dashboard.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Admin or Project Manager role required.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const computeDateParams = useCallback(
    (range: string) => {
      const now = new Date();
      switch (range) {
        case 'this-week': {
          const start = new Date(now);
          start.setDate(start.getDate() - start.getDay());
          return {
            dateFrom: start.toISOString().slice(0, 10),
            dateTo: now.toISOString().slice(0, 10),
          };
        }
        case 'this-month':
          return {
            dateFrom: new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .slice(0, 10),
            dateTo: now.toISOString().slice(0, 10),
          };
        case 'last-month': {
          const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const last = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            dateFrom: first.toISOString().slice(0, 10),
            dateTo: last.toISOString().slice(0, 10),
          };
        }
        default:
          return {};
      }
    },
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = computeDateParams(dateRange);
      const result = await dashboardApi.getExecutive({
        department: department || undefined,
        ...dateParams,
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [department, dateRange, computeDateParams]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user?.mustResetPw) router.replace('/change-password');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user && (user.role === 'Admin' || user.role === 'ProjectManager')) {
      fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
    if (data?.workloadBars) {
      const depts = new Set<string>();
      if (user?.department) depts.add(user.department);
      setDepartments(Array.from(depts));
    }
  }, [data, user]);

  if (isLoading) return <LoadingSkeleton />;
  if (!user) return null;
  if (user.role !== 'Admin' && user.role !== 'ProjectManager')
    return <Forbidden />;

  const isAdminOrPM = user.role === 'Admin' || user.role === 'ProjectManager';

  const maxWorkload = data
    ? Math.max(...data.workloadBars.map((w) => w.openTasks), 1)
    : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Executive Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">All Time</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
            </select>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <LoadingSkeleton />
        ) : data ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                title="Active Projects"
                value={data.summaryCards.activeProjects}
                icon=""
              />
              <SummaryCard
                title="Overdue Tasks"
                value={data.summaryCards.overdueTasks}
                icon=""
              />
              <SummaryCard
                title="Completed This Week"
                value={data.summaryCards.completedThisWeek}
                icon=""
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-800">
                  Project Health (RAG)
                </h2>
                {data.projectHealth.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No projects match these filters.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.projectHealth.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <RagDot color={p.rag as RagColor} />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {p.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {p.owner?.fullName ?? '—'} · {p.totalTasks} tasks
                              · {p.overdueTasks} overdue
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.rag === 'Green'
                              ? 'bg-green-100 text-green-700'
                              : p.rag === 'Amber'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.rag}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-800">
                  Team Workload (Open Tasks)
                </h2>
                {data.workloadBars.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No open tasks assigned.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.workloadBars.map((w) => (
                      <WorkloadBar
                        key={w.assigneeId}
                        name={w.assigneeName}
                        count={w.openTasks}
                        max={maxWorkload}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}