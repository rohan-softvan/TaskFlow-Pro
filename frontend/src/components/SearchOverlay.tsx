'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchApi, SearchResults } from '@/lib/api';

interface Props {
  onClose: () => void;
}

export function SearchOverlay({ onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    searchApi
      .search({ q: term })
      .then((r) => setResults(r))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(val: string) {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const total =
    (results?.projects.length ?? 0) +
    (results?.tasks.length ?? 0) +
    (results?.comments.length ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="mr-2 text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, comments…"
            value={q}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 py-4 text-sm outline-none"
          />
          {loading && <span className="ml-2 text-xs text-gray-400">…</span>}
          <button
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-600"
            aria-label="Close search"
          >
            ✕
          </button>
        </div>

        {results && (
          <div className="max-h-96 overflow-y-auto p-2">
            {total === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No results found.</p>
            )}

            {results.projects.length > 0 && (
              <section>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Projects
                </div>
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      router.push(`/projects/${p.id}`);
                      onClose();
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="mt-0.5 text-base">📁</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.name}</div>
                      {p.description && (
                        <div className="truncate text-xs text-gray-500">{p.description}</div>
                      )}
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-gray-400">{p.status}</span>
                  </button>
                ))}
              </section>
            )}

            {results.tasks.length > 0 && (
              <section>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Tasks
                </div>
                {results.tasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      router.push(`/projects/${t.projectId}/tasks/${t.id}`);
                      onClose();
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="mt-0.5 text-base">✅</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{t.title}</div>
                      {t.description && (
                        <div className="truncate text-xs text-gray-500">{t.description}</div>
                      )}
                    </div>
                    <div className="ml-auto shrink-0 text-right text-xs text-gray-400">
                      <div>{t.status}</div>
                      <div>{t.priority}</div>
                    </div>
                  </button>
                ))}
              </section>
            )}

            {results.comments.length > 0 && (
              <section>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Comments
                </div>
                {results.comments.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      router.push(`/projects/${getProjectFromTaskId(results, c.taskId)}/tasks/${c.taskId}`);
                      onClose();
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="mt-0.5 text-base">💬</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gray-700">{c.body}</div>
                    </div>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {!results && !loading && q.trim() === '' && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            Type to search across your projects
          </p>
        )}
      </div>
    </div>
  );
}

function getProjectFromTaskId(results: SearchResults, taskId: string): string {
  const task = results.tasks.find((t) => t.id === taskId);
  return task?.projectId ?? '';
}
