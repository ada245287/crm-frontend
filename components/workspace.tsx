"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, CircleCheck, ChevronRight, CircleAlert, Columns3, LayoutDashboard, LogOut, Menu, MessageSquare, MoonStar, Settings2, Shield, Users, UserRound, X } from "lucide-react";
import { labels, request, roles, today, type Settings, type User } from "../lib/crm";
import { Avatar, Skeleton } from "./ui";
import { Dashboard, Clients, ClientDetail, Deals, Tasks } from "./sales";
import { Chats, Admin, Prayer } from "./operations";

const navigation = [
  { id: "dashboard", title: "Дашборд", icon: LayoutDashboard },
  { id: "chats", title: "Переписки", icon: MessageSquare },
  { id: "clients", title: "Клиенты", icon: Users },
  { id: "deals", title: "Воронка продаж", icon: Columns3 },
  { id: "tasks", title: "Задачи", icon: CircleCheck },
  { id: "prayer", title: "Время намаза", icon: MoonStar },
  { id: "admin", title: "Настройки CRM", icon: Settings2 },
] as const;
type View = typeof navigation[number]["id"] | "client" | "login";
export type Api = <T>(path: string, method?: string, data?: unknown) => Promise<T>;
export interface ScreenProps {
  api: Api;
  user: User;
  users: User[];
  labels: string[];
  notify: (message: string, error?: boolean) => void;
  refresh: () => void;
}
const descriptions: Record<Exclude<View, "login">, string> = {
  dashboard: "Продажи, заявки и работа команды в одном месте.",
  chats: "Входящие сообщения и ответы менеджеров.",
  clients: "Контакты учеников и история работы с заявками.",
  client: "Контакты, сделки и задачи по клиенту.",
  deals: "Перемещайте сделки между этапами или меняйте этап в карточке.",
  tasks: "Следите за сроками и отмечайте выполненное.",
  prayer: "Расписание пяти намазов для вашего города.",
  admin: "Команда, распределение заявок и материалы школы.",
};

function Brand() {
  return <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span><strong>Nahr CRM</strong><small>Школа арабского языка</small></span></div>;
}
export function Workspace({ view, id }: { view: View; id?: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean }>();
  const [stageLabels, setStageLabels] = useState(labels);
  const user = users.find(account => account.id === userId);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  const refresh = useCallback(() => {
    setError("");
    request<User[]>("/users").then(setUsers).catch(reason => setError(reason.message)).finally(() => setReady(true));
    if (userId) request<Settings>("/settings", userId).then(settings => setStageLabels(settings.labels)).catch(() => {});
  }, [userId]);
  useEffect(() => { setUserId(localStorage.getItem("nahr-user")); }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    if (view !== "login" && ready && !error && !user) router.replace("/login");
  }, [view, ready, error, user, router]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(undefined), 4300);
    return () => clearTimeout(timeout);
  }, [toast]);
  const api: Api = useCallback((path, method, data) => request(path, userId ?? undefined, method, data), [userId]);
  const login = (account: User) => { localStorage.setItem("nahr-user", account.id); setUserId(account.id); router.push("/dashboard"); };
  const logout = () => { localStorage.removeItem("nahr-user"); setUserId(null); router.push("/login"); };
  if (view === "login") return <main className="login">
    <section className="login-frame"><Brand /><p className="eyebrow">ДЕМО-ПРОСТРАНСТВО</p><h1>Вход в Nahr CRM</h1>
      <p className="muted">Выберите роль, чтобы открыть рабочее пространство школы.</p>
      {error ? <div className="error">{error} <button onClick={refresh}>Повторить</button></div> : !ready ? <Skeleton /> :
        <div className="login-roles">{users.map(account => {
          const Icon = account.role === "admin" ? Shield : account.role === "rop" ? LayoutDashboard : UserRound;
          return <button key={account.id} onClick={() => login(account)}><span className="metric-icon"><Icon size={20} /></span><span><strong>{roles[account.role]}</strong><small>{account.name}</small></span><ArrowRight size={17} /></button>;
        })}</div>}
      <p className="login-note">Учебная CRM · Синтетические данные</p>
    </section><aside className="login-art" aria-hidden="true"><div className="art-grid" /><span lang="ar">نهر</span></aside>
  </main>;
  const title = view === "client" ? "Карточка клиента" : navigation.find(item => item.id === view)?.title;
  const props = user && { api, user, users, labels: stageLabels, notify, refresh };
  return <div className="shell">
    {menu && <button className="scrim" onClick={() => setMenu(false)} aria-label="Закрыть меню" />}
    <aside className={`sidebar ${menu ? "opened" : ""}`}><Brand />
      <div className="workspace-label"><span className="workspace-icon">N</span><div><strong>Школа Nahr</strong><small>Рабочее пространство</small></div></div>
      <p className="nav-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
      <nav>{navigation.filter(item => item.id !== "admin" || user?.role === "admin").map(({ id: link, title, icon: Icon }) =>
        <Link key={link} href={`/${link}`} onClick={() => setMenu(false)} aria-current={view === link || (view === "client" && link === "clients") ? "page" : undefined} className={view === link || (view === "client" && link === "clients") ? "selected" : ""}>
          <Icon size={18} strokeWidth={1.75} />{title}
        </Link>)}</nav>
      {user && <div className="profile"><Avatar name={user.name} /><span><strong>{user.name}</strong><small>{roles[user.role]}</small></span><button className="icon" title="Выйти" aria-label="Выйти" onClick={logout}><LogOut size={16} /></button></div>}
    </aside>
    <div className="main"><header className="topbar"><div className="breadcrumb"><button className="icon menu-trigger" aria-label="Открыть меню" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={22} /></button><span>Рабочее пространство</span><ChevronRight size={14} /><strong>{title}</strong></div><span className="demo"><i /> Демо-режим</span></header>
      <main className="content">
        {view === "client" && <Link href="/clients" className="back"><ArrowLeft size={16} /> Все клиенты</Link>}
        <div className="page-head"><div><h1>{title}</h1><p>{descriptions[view]}</p></div>{view === "dashboard" && <span className="date-chip"><CalendarDays size={16} />{new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Asia/Almaty" }).format(new Date(today() + "T12:00:00Z"))}</span>}</div>
        {error ? <div className="error">{error} <button onClick={refresh}>Повторить</button></div> : !props ? <Skeleton /> : <>
          {view === "dashboard" && <Dashboard {...props} />}
          {view === "clients" && <Clients {...props} />}
          {view === "client" && id && <ClientDetail {...props} id={id} />}
          {view === "deals" && <Deals {...props} />}
          {view === "tasks" && <Tasks {...props} />}
          {view === "chats" && <Chats {...props} />}
          {view === "prayer" && <Prayer {...props} />}
          {view === "admin" && (user?.role === "admin" ? <Admin {...props} /> : <div className="error">Доступно администратору</div>)}
        </>}
      </main>
    </div>
    {toast && <div className={`toast ${toast.error ? "danger" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <CircleAlert size={18} /> : <CircleCheck size={18} />}{toast.message}<button className="icon" aria-label="Закрыть уведомление" onClick={() => setToast(undefined)}><X size={16} /></button></div>}
  </div>;
}
