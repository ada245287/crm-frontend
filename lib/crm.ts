export const stages = ["new", "qualified", "negotiation", "payment", "won", "lost"] as const;
export type Stage = typeof stages[number];
export const labels = ["Новый", "Квалификация", "Переговоры", "Оплата", "Успех", "Отказ"];
export const roles = { admin: "Админ", rop: "РОП", manager: "Менеджер" };
export interface User { id: string; name: string; role: keyof typeof roles; receiveLeads: boolean; canReply: boolean }
export interface Client { id: string; ownerId: string; name: string; phone: string; email: string; source: string; createdAt: string }
export interface Deal { id: string; ownerId: string; clientId: string; title: string; amount: number; stage: Stage }
export interface Task { id: string; ownerId: string; clientId: string; title: string; dueAt: string; done: boolean }
export interface Message { id: string; text: string; from: "client" | "manager" | "bot"; ownerId: string; at: string }
export interface Chat { id: string; ownerId: string; client: Client; messages: Message[]; unread: boolean; handoff: boolean }
export interface Settings { enabled: boolean; start: number; end: number; autoAssign: boolean; labels: string[] }
export interface Article { id: string; title: string; kind: string; keywords: string; text: string }
export interface Stats {
  leads: number; active: number; pipeline: number; conversion: number;
  stages: { stage: Stage; count: number }[];
  tasks: Task[];
  periods: { revenue: number; payments: number; leads: number }[];
  chats: { active: number; unread: number };
  team: { name: string; leads: number; active: number; revenue: number }[];
}
export const money = (amount: number) => new Intl.NumberFormat("ru-RU").format(amount) + " ₸";
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("");
export const date = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Almaty" }).format(new Date(value));
export const clock = (value: string) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }).format(new Date(value));
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty" }).format();
export async function request<T>(path: string, user?: string, method = "GET", data?: unknown): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (user) headers["X-User-Id"] = user;
  if (data !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(base + path, { headers, method, body: data === undefined ? undefined : JSON.stringify(data), cache: "no-store" });
  } catch { throw new Error("CRM API недоступен. Проверьте соединение и адрес сервера."); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? "Не удалось выполнить запрос");
  }
  return response.status === 204 ? undefined as T : response.json();
}
