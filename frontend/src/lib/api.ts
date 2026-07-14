const BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

let _accessToken: string | null = null;
let _tokenExp: number | null = null; // unix seconds

export function getAccessToken() {
  return _accessToken;
}

export function setAccessToken(token: string) {
  _accessToken = token;
  // Decode exp from JWT payload (no verification needed client-side)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    _tokenExp = payload.exp ?? null;
  } catch {
    _tokenExp = null;
  }
}

export function clearAccessToken() {
  _accessToken = null;
  _tokenExp = null;
}

async function ensureFreshToken() {
  if (!_accessToken || !_tokenExp) return;
  const nowS = Math.floor(Date.now() / 1000);
  if (_tokenExp - nowS < 60) {
    // < 60s remaining — refresh proactively
    try {
      const data = await authApi.refresh();
      setAccessToken(data.accessToken);
    } catch {
      clearAccessToken();
    }
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  await ensureFreshToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  return fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      message = err.message || message;
    } catch {
      // ignore
    }
    throw new Error(Array.isArray(message) ? message.join('; ') : message);
  }
  return JSON.parse(text) as T;
}

export type UserRole = 'Admin' | 'ProjectManager' | 'Member' | 'Viewer';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
  role: UserRole;
  mustResetPw: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  mustResetPw: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  role?: UserRole;
  department?: string;
}

export interface UpdateUserPayload {
  role?: UserRole;
  isActive?: boolean;
  department?: string;
  fullName?: string;
}

export const usersApi = {
  async list(): Promise<UserRecord[]> {
    const res = await apiFetch('/users');
    return parseJson<UserRecord[]>(res);
  },

  async create(payload: CreateUserPayload): Promise<UserRecord & { tempPassword: string }> {
    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return parseJson<UserRecord & { tempPassword: string }>(res);
  },

  async update(id: string, payload: UpdateUserPayload): Promise<UserRecord> {
    const res = await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return parseJson<UserRecord>(res);
  },

  async deactivate(id: string): Promise<UserRecord> {
    const res = await apiFetch(`/users/${id}/deactivate`, { method: 'PATCH' });
    return parseJson<UserRecord>(res);
  },

  async resetPassword(id: string): Promise<{ tempPassword: string }> {
    const res = await apiFetch(`/users/${id}/reset-password`, { method: 'POST' });
    return parseJson<{ tempPassword: string }>(res);
  },

  async changePassword(newPassword: string): Promise<{ message: string }> {
    const res = await apiFetch('/users/me/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    });
    return parseJson<{ message: string }>(res);
  },
};

export interface ProfileRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string | null;
  bio: string | null;
  avatarPath: string | null;
  isActive: boolean;
  mustResetPw: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  department?: string;
  bio?: string;
}

export const profileApi = {
  async getMe(): Promise<ProfileRecord> {
    const res = await apiFetch('/users/me');
    return parseJson<ProfileRecord>(res);
  },

  async update(payload: UpdateProfilePayload): Promise<ProfileRecord> {
    const res = await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return parseJson<ProfileRecord>(res);
  },

  async uploadAvatar(file: File): Promise<ProfileRecord> {
    await ensureFreshToken();
    const form = new FormData();
    form.append('file', file);
    // NOTE: do NOT set Content-Type — the browser adds the multipart boundary.
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/users/me/avatar`, {
      method: 'POST',
      body: form,
      headers,
      credentials: 'include',
    });
    return parseJson<ProfileRecord>(res);
  },

  // Fetches the current user's avatar as a Blob (auth'd route). null if none.
  async fetchAvatarBlob(): Promise<Blob | null> {
    const res = await apiFetch('/users/me/avatar');
    if (!res.ok) return null;
    return res.blob();
  },
};

export const authApi = {
  async register(
    email: string,
    password: string,
    fullName: string,
  ): Promise<TokenResponse> {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
      credentials: 'include',
    });
    return parseJson<TokenResponse>(res);
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    return parseJson<TokenResponse>(res);
  },

  async refresh(): Promise<TokenResponse> {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return parseJson<TokenResponse>(res);
  },

  async logout(): Promise<void> {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};

export type ProjectStatus = 'Planning' | 'Active' | 'OnHold' | 'Completed';

export interface ProjectOwner {
  id: string;
  fullName: string;
  email: string;
  avatarPath: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner: ProjectOwner;
  progress: number;
  _count: { tasks: number };
}

export interface ProjectMemberRecord {
  projectId: string;
  userId: string;
  addedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    department: string | null;
    avatarPath: string | null;
  };
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMemberRecord[];
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export const projectsApi = {
  async list(archived = false): Promise<ProjectSummary[]> {
    const res = await apiFetch(`/projects${archived ? '?archived=true' : ''}`);
    return parseJson<ProjectSummary[]>(res);
  },

  async get(id: string): Promise<ProjectDetail> {
    const res = await apiFetch(`/projects/${id}`);
    return parseJson<ProjectDetail>(res);
  },

  async create(payload: CreateProjectPayload): Promise<ProjectSummary> {
    const res = await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return parseJson<ProjectSummary>(res);
  },

  async update(id: string, payload: UpdateProjectPayload): Promise<ProjectSummary> {
    const res = await apiFetch(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return parseJson<ProjectSummary>(res);
  },

  async changeStatus(id: string, status: ProjectStatus): Promise<ProjectSummary> {
    const res = await apiFetch(`/projects/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return parseJson<ProjectSummary>(res);
  },

  async setArchived(id: string, archive: boolean): Promise<ProjectSummary> {
    const res = await apiFetch(`/projects/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ archive }),
    });
    return parseJson<ProjectSummary>(res);
  },

  async members(id: string): Promise<ProjectMemberRecord[]> {
    const res = await apiFetch(`/projects/${id}/members`);
    return parseJson<ProjectMemberRecord[]>(res);
  },

  async addMember(id: string, userId: string): Promise<ProjectMemberRecord> {
    const res = await apiFetch(`/projects/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return parseJson<ProjectMemberRecord>(res);
  },

  async removeMember(id: string, userId: string): Promise<void> {
    const res = await apiFetch(`/projects/${id}/members/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) await parseJson(res);
  },
};

export type TaskStatus = 'ToDo' | 'InProgress' | 'InReview' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ActivityAction =
  | 'StatusChanged'
  | 'AssigneeChanged'
  | 'CommentAdded'
  | 'AttachmentAdded'
  | 'DueDateChanged'
  | 'TaskCreated'
  | 'TaskDeleted';

export interface TaskUser {
  id: string;
  fullName: string;
  email: string;
  avatarPath: string | null;
}

export interface ActivityLogEntry {
  id: string;
  taskId: string | null;
  projectId: string | null;
  actorId: string;
  action: ActivityAction;
  detail: Record<string, unknown> | null;
  createdAt: string;
  actor: TaskUser;
}

export interface TaskAttachmentRecord {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  uploader: TaskUser;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee: TaskUser | null;
  creator: TaskUser;
  _count: { subtasks: number };
}

export interface TaskDetail extends Omit<TaskSummary, '_count'> {
  activityLogs: ActivityLogEntry[];
  attachments?: TaskAttachmentRecord[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

export const tasksApi = {
  async list(projectId: string): Promise<TaskSummary[]> {
    const res = await apiFetch(`/projects/${projectId}/tasks`);
    return parseJson<TaskSummary[]>(res);
  },

  async get(projectId: string, taskId: string): Promise<TaskDetail> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}`);
    return parseJson<TaskDetail>(res);
  },

  async create(projectId: string, payload: CreateTaskPayload): Promise<TaskSummary> {
    const res = await apiFetch(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return parseJson<TaskSummary>(res);
  },

  async update(projectId: string, taskId: string, payload: UpdateTaskPayload): Promise<TaskSummary> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return parseJson<TaskSummary>(res);
  },

  async remove(projectId: string, taskId: string): Promise<void> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    if (!res.ok) await parseJson(res);
  },
};

export interface SubtaskSummary {
  id: string;
  projectId: string;
  parentTaskId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee: TaskUser | null;
  creator: TaskUser;
}

export interface CreateSubtaskPayload {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: TaskPriority;
}

export interface CommentMentionRecord {
  commentId: string;
  mentionedUser: string;
  user: TaskUser;
}

export interface TaskCommentRecord {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: TaskUser;
  mentions: CommentMentionRecord[];
}

export const subtasksApi = {
  async list(projectId: string, taskId: string): Promise<SubtaskSummary[]> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}/subtasks`);
    return parseJson<SubtaskSummary[]>(res);
  },

  async create(projectId: string, taskId: string, payload: CreateSubtaskPayload): Promise<SubtaskSummary> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return parseJson<SubtaskSummary>(res);
  },

  async remove(projectId: string, taskId: string): Promise<void> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    if (!res.ok) await parseJson(res);
  },
};

export const commentsApi = {
  async list(projectId: string, taskId: string): Promise<TaskCommentRecord[]> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}/comments`);
    return parseJson<TaskCommentRecord[]>(res);
  },

  async create(projectId: string, taskId: string, body: string): Promise<TaskCommentRecord> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return parseJson<TaskCommentRecord>(res);
  },

  async remove(projectId: string, taskId: string, commentId: string): Promise<void> {
    const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) await parseJson(res);
  },
};

export const attachmentsApi = {
  async list(taskId: string): Promise<TaskAttachmentRecord[]> {
    const res = await apiFetch(`/tasks/${taskId}/attachments`);
    return parseJson<TaskAttachmentRecord[]>(res);
  },

  async upload(taskId: string, file: File): Promise<TaskAttachmentRecord> {
    await ensureFreshToken();
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: form,
      headers,
      credentials: 'include',
    });

    return parseJson<TaskAttachmentRecord>(res);
  },

  downloadUrl(attachmentId: string): string {
    return `${BASE}/attachments/${attachmentId}/download`;
  },

  async remove(attachmentId: string): Promise<void> {
    const res = await apiFetch(`/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) await parseJson(res);
  },
};

export interface DashboardSummaryCards {
  activeProjects: number;
  overdueTasks: number;
  completedThisWeek: number;
}

export interface ProjectHealthEntry {
  id: string;
  name: string;
  status: string;
  owner: { id: string; fullName: string; email: string } | null;
  totalTasks: number;
  overdueTasks: number;
  rag: 'Green' | 'Amber' | 'Red';
}

export interface WorkloadBarEntry {
  assigneeId: string;
  assigneeName: string;
  openTasks: number;
}

export interface ExecutiveDashboardResponse {
  summaryCards: DashboardSummaryCards;
  projectHealth: ProjectHealthEntry[];
  workloadBars: WorkloadBarEntry[];
}

export const dashboardApi = {
  async getExecutive(params?: {
    department?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ExecutiveDashboardResponse> {
    const qs = new URLSearchParams();
    if (params?.department) qs.set('department', params.department);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    const query = qs.toString();
    const res = await apiFetch(`/dashboard/executive${query ? `?${query}` : ''}`);
    return parseJson<ExecutiveDashboardResponse>(res);
  },
};
