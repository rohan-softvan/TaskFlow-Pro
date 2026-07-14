'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import {
  projectsApi,
  tasksApi,
  attachmentsApi,
  type ProjectMemberRecord,
  type TaskDetail,
  type TaskAttachmentRecord,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/api';

const TASK_STATUS_OPTIONS: TaskStatus[] = ['ToDo', 'InProgress', 'InReview', 'Done'];
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];

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

function actionLabel(action: string, detail: Record<string, unknown> | null): string {
  if (action === 'TaskCreated') return 'created this task';
  if (action === 'StatusChanged')
    return `changed status from ${detail?.from ?? '?'} → ${detail?.to ?? '?'}`;
  if (action === 'AssigneeChanged')
    return `changed assignee`;
  if (action === 'DueDateChanged')
    return `changed due date from ${detail?.from ?? 'none'} → ${detail?.to ?? 'none'}`;
  if (action === 'CommentAdded') return 'added a comment';
  if (action === 'AttachmentAdded') return 'added an attachment';
  if (action === 'TaskDeleted') return 'deleted this task';
  return action;
}

export default function TaskDetailPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string; taskId: string }>();
  const projectId = params.id;
  const taskId = params.taskId;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [members, setMembers] = useState<ProjectMemberRecord[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('ToDo');
  const [editPriority, setEditPriority] = useState<TaskPriority>('Medium');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    try {
      const [t, mems, atts] = await Promise.all([
        tasksApi.get(projectId, taskId),
        projectsApi.members(projectId).catch(() => [] as ProjectMemberRecord[]),
        attachmentsApi.list(taskId).catch(() => [] as TaskAttachmentRecord[]),
      ]);
      setTask(t);
      setMembers(mems);
      setAttachments(atts);
      setEditTitle(t.title);
      setEditStatus(t.status);
      setEditPriority(t.priority);
      setEditAssigneeId(t.assigneeId ?? '');
      setEditDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '');
      setEditDescription(t.description ?? '');
      setFetchError('');
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load task');
    }
  }, [projectId, taskId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await tasksApi.update(projectId, taskId, {
        title: editTitle,
        description: editDescription || undefined,
        status: editStatus,
        priority: editPriority,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
      });
      setActionMsg('Task updated.');
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      await attachmentsApi.upload(taskId, file);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      await attachmentsApi.remove(attachmentId);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Failed to delete attachment');
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{fetchError}</div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            ← Back to Project
          </button>
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  const canEdit =
    user.role === 'Admin' ||
    user.role === 'ProjectManager' ||
    task.createdBy === user.id ||
    task.assigneeId === user.id;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="mb-4 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          ← Project
        </button>

        {actionMsg && (
          <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {actionMsg}{' '}
            <button onClick={() => setActionMsg('')} className="ml-2 text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Task Detail Card */}
        <div className="rounded-xl bg-white p-6 shadow-md">
          <form onSubmit={handleSave}>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-500">Title</label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
                placeholder="No description"
              />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                <select
                  disabled={!canEdit}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
                >
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Priority</label>
                <select
                  disabled={!canEdit}
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
                >
                  {TASK_PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Assignee</label>
                <select
                  disabled={!canEdit}
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Due Date</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t pt-4">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}
              >
                {statusLabel(task.status)}
              </span>
              <span className="text-xs text-gray-400">
                Created by {task.creator.fullName} ·{' '}
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Attachments */}
        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Attachments ({attachments.length})
            </h2>
            {canEdit && (
              <label className="cursor-pointer rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {uploading ? 'Uploading…' : '+ Upload'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUploadAttachment}
                />
              </label>
            )}
          </div>

          {uploadError && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {attachments.length === 0 ? (
            <p className="text-sm text-gray-400">No attachments yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {attachments.map((att) => {
                const isOwner = att.uploadedBy === user.id;
                const canDelete = isOwner || user.role === 'Admin' || user.role === 'ProjectManager';
                return (
                  <li key={att.id} className="flex items-center gap-3 py-3">
                    <span className="text-lg">📎</span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={attachmentsApi.downloadUrl(att.id)}
                        className="truncate text-sm font-medium text-blue-600 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {att.fileName}
                      </a>
                      <div className="text-xs text-gray-400">
                        {formatFileSize(att.sizeBytes)} · {att.uploader.fullName}
                      </div>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="shrink-0 text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Activity Log */}
        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Activity ({task.activityLogs.length})
          </h2>
          {task.activityLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {task.activityLogs.map((log) => (
                <li key={log.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 uppercase">
                    {log.actor.fullName.charAt(0)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{log.actor.fullName}</span>{' '}
                    <span className="text-gray-600">
                      {actionLabel(log.action, log.detail as Record<string, unknown> | null)}
                    </span>
                    <div className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
