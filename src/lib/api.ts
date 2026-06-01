// Lightweight REST client that replaces the Supabase client. Attaches the JWT
// from localStorage and exposes typed resource helpers grouped by domain.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/files`, { method: "POST", headers, body: form });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data?.error ?? "Upload failed", res.status);
  return data;
}

export const api = {
  getToken,
  setToken,
  uploadFile,

  auth: {
    login: (email: string, password: string) =>
      request("POST", "/auth/login", { email, password }),
    signup: (payload: { email: string; password: string; name: string; employee_id?: string; contact?: string }) =>
      request("POST", "/auth/signup", payload),
    session: () => request("GET", "/auth/session"),
    changePassword: (currentPassword: string, newPassword: string) =>
      request("PATCH", "/auth/password", { currentPassword, newPassword }),
  },

  tickets: {
    list: (params: Record<string, string | number | boolean | undefined> = {}) =>
      request("GET", `/tickets${qs(params)}`),
    get: (id: string) => request("GET", `/tickets/${id}`),
    create: (payload: Record<string, unknown>) => request("POST", "/tickets", payload),
    update: (id: string, updates: Record<string, unknown>) => request("PATCH", `/tickets/${id}`, updates),
    remove: (id: string) => request("DELETE", `/tickets/${id}`),

    history: (id: string) => request("GET", `/tickets/${id}/history`),
    addHistory: (id: string, payload: Record<string, unknown>) =>
      request("POST", `/tickets/${id}/history`, payload),

    messages: (id: string) => request("GET", `/tickets/${id}/messages`),
    sendMessage: (id: string, payload: { message?: string | null; attachments?: unknown[] }) =>
      request("POST", `/tickets/${id}/messages`, payload),

    rating: (id: string) => request("GET", `/tickets/${id}/rating`),
    addRating: (id: string, payload: { rating: number; feedback?: string | null }) =>
      request("POST", `/tickets/${id}/rating`, payload),
  },

  profiles: {
    list: (params: { department_id?: string; role?: string } = {}) => request("GET", `/profiles${qs(params)}`),
    me: () => request("GET", "/profiles/me"),
    updateMe: (updates: Record<string, unknown>) => request("PATCH", "/profiles/me", updates),
  },

  users: {
    list: () => request("GET", "/users"),
    create: (payload: Record<string, unknown>) => request("POST", "/users", payload),
    updateProfile: (id: string, updates: Record<string, unknown>) =>
      request("PATCH", `/users/${id}/profile`, updates),
    updateCredentials: (id: string, payload: { email?: string; password?: string }) =>
      request("PATCH", `/users/${id}/credentials`, payload),
    updateRole: (id: string, role: string) => request("PATCH", `/users/${id}/role`, { role }),
    remove: (id: string) => request("DELETE", `/users/${id}`),
    bulkImport: (users: Record<string, unknown>[]) => request("POST", "/users/bulk-import", { users }),
  },

  units: {
    list: () => request("GET", "/units"),
    create: (name: string) => request("POST", "/units", { name }),
    update: (id: string, name: string) => request("PATCH", `/units/${id}`, { name }),
    remove: (id: string) => request("DELETE", `/units/${id}`),
  },

  departments: {
    list: (params: { active?: boolean } = {}) => request("GET", `/departments${qs(params)}`),
    create: (payload: { name: string; unit_id?: string | null }) => request("POST", "/departments", payload),
    update: (id: string, updates: Record<string, unknown>) => request("PATCH", `/departments/${id}`, updates),
    remove: (id: string) => request("DELETE", `/departments/${id}`),
  },

  roles: {
    list: () => request("GET", "/roles"),
    getByName: (name: string) => request("GET", `/roles${qs({ name })}`),
    create: (payload: Record<string, unknown>) => request("POST", "/roles", payload),
    update: (id: string, updates: Record<string, unknown>) => request("PATCH", `/roles/${id}`, updates),
    remove: (id: string) => request("DELETE", `/roles/${id}`),
  },

  ratings: {
    list: () => request("GET", "/ratings"),
  },

  notifications: {
    list: (limit = 10) => request("GET", `/notifications${qs({ limit })}`),
    create: (payload: Record<string, unknown>) => request("POST", "/notifications", payload),
    markRead: (id: string) => request("PATCH", `/notifications/${id}/read`),
    markAllRead: () => request("PATCH", "/notifications/read-all"),
  },
};
