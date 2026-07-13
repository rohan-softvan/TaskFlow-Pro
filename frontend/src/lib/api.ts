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

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  userId: string;
}

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
