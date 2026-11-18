"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, Check, Clock3, GripVertical, Mail, Phone, Plus, Search, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { date, money, stages, type Client, type Deal, type Stage, type Stats, type Task } from "../lib/crm";
import type { ScreenProps } from "./workspace";
import { Avatar, Empty, Modal, Skeleton, submit } from "./ui";

export function useData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try { setData(await loader()); setError(""); }
    catch (reason) { setError((reason as Error).message); }
  }, [loader]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload, setData };
}
export function Pending({ error, reload }: { error: string; reload: () => void }) {
  return error ? <div className="error" role="alert">{error} <button onClick={reload}>Повторить</button></div> : <Skeleton />;
}
export function stageName(labels: string[], stage: Stage) { return labels[stages.indexOf(stage)]; }
function StageBadge({ labels, stage }: { labels: string[]; stage: Stage }) {
  return <span className={`stage stage-${stage}`}><i />{stageName(labels, stage)}</span>;
}
function TaskRow({ task, onChange }: { task: Task; onChange?: () => void }) {
  const overdue = !task.done && new Date(task.dueAt).getTime() < Date.now();
  return <div className="task-row">
    {onChange ? <label className="check"><input type="checkbox" checked={task.done} onChange={onChange} aria-label={task.title} /><span>{task.done && <Check size={14} />}</span></label> :
      <span className="task-icon"><Clock3 size={16} /></span>}
    <Link className={task.done ? "completed" : ""} href={`/clients/${task.clientId}`}>{task.title}</Link>
    <span className={overdue ? "overdue" : "muted"}>{date(task.dueAt)}</span>
  </div>;
}
export function Dashboard({ api, labels, user }: ScreenProps) {
  const [period, setPeriod] = useState(0);
  const load = useCallback(() => api<Stats>("/stats"), [api]);
  const { data, error, reload } = useData(load);
  if (!data || error) return <Pending error={error} reload={reload} />;
  const metrics = [
    { title: "Новые лиды", value: data.leads, icon: Users, detail: "За сегодня" },
    { title: "Сделки в работе", value: data.active, icon: BriefcaseBusiness, detail: "На открытых этапах" },
    { title: "Сумма воронки", value: money(data.pipeline), icon: Wallet, detail: "По открытым сделкам" },
    { title: "Конверсия", value: data.conversion + "%", icon: ChartNoAxesCombined, detail: "Успех среди закрытых сделок" },
  ];
  const totals = data.periods[period];
  const reach = (index: number) => {
    const funnel = data.stages.slice(0, 5);
    const progressed = funnel.slice(index).reduce((total, item) => total + item.count, 0);
    const previous = index ? funnel.slice(index - 1).reduce((total, item) => total + item.count, 0) : data.stages.reduce((total, item) => total + item.count, 0);
    return previous ? Math.round(progressed / previous * 100) : 0;
  };
  return <>
    <div className="metrics">{metrics.map(({ title, value, icon: Icon, detail }) => <section className="card metric" key={title}>
      <div className="metric-top"><span className="metric-icon"><Icon size={19} strokeWidth={1.8} /></span><ArrowUpRight size={16} className="muted subtle" /></div>
      <p>{title}</p><strong>{value}</strong><small>{detail}</small>
    </section>)}</div>
    <div className="dash-grid">
      <section className="card panel"><div className="section-head"><div><h2>Сделки по этапам</h2><p>Текущее распределение по воронке</p></div><Link className="text-link" href="/deals">Воронка <ArrowRight size={15} /></Link></div>
        <div className="chart"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data.stages.map(item => ({ ...item, name: stageName(labels, item.stage) }))} margin={{ left: -24, right: 5, top: 14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#edf0f6" strokeDasharray="4 4" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#65728a", fontSize: 10 }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#65728a", fontSize: 11 }} /><Tooltip cursor={{ fill: "#edf2ff" }} />
          <Bar dataKey="count" name="Сделки" fill="#315bd5" radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart></ResponsiveContainer></div>
        <div className="funnel-rate">{data.stages.slice(0, 5).map(({ stage }, index) => <span key={stage}>{stageName(labels, stage)} <strong>{reach(index)}%</strong></span>)}</div>
      </section>
      <section className="card panel"><div className="section-head"><div><h2>Ближайшие задачи</h2><p>Открытые задачи по сроку</p></div><Link className="text-link" href="/tasks">Все <ArrowRight size={15} /></Link></div>
        {data.tasks.length ? data.tasks.map(task => <TaskRow key={task.id} task={task} />) : <Empty>Открытых задач нет</Empty>}
      </section>
    </div>
    <div className="dash-grid">
      <section className="card panel"><div className="section-head"><h2>Продажи</h2><div className="segmented">{["День", "Неделя", "Месяц"].map((item, index) => <button key={item} className={period === index ? "active" : ""} onClick={() => setPeriod(index)}>{item}</button>)}</div></div>
        <div className="totals"><div><small>Выручка</small><strong>{money(totals.revenue)}</strong></div><div><small>Оплаты</small><strong>{totals.payments}</strong></div><div><small>Новые заявки</small><strong>{totals.leads}</strong></div></div>
      </section>
      <section className="card panel"><div className="section-head"><h2>Переписки</h2><Link href="/chats" className="text-link">Открыть <ArrowRight size={15} /></Link></div>
        <div className="totals"><div><small>Активные</small><strong>{data.chats.active}</strong></div><div><small>Необработанные</small><strong>{data.chats.unread}</strong></div></div>
      </section>
    </div>
    <section className="card table-card"><div className="panel section-head"><h2>{user.role === "manager" ? "Моя статистика" : "Статистика команды"}</h2></div>
      <div className="table-scroll"><table><thead><tr><th>Сотрудник</th><th>Заявки</th><th>В работе</th><th>Выручка</th></tr></thead><tbody>{data.team.map(member => <tr key={member.name}><td>{member.name}</td><td>{member.leads}</td><td>{member.active}</td><td>{money(member.revenue)}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}

export function Clients({ api, labels, users, user, notify }: ScreenProps) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => Promise.all([api<Client[]>("/clients"), api<Deal[]>("/deals")]), [api]);
  const { data, error, reload } = useData(load);
  if (!data || error) return <Pending error={error} reload={reload} />;
  const [clients, deals] = data;
  const filtered = clients.filter(client => {
    const matches = deals.filter(item => item.clientId === client.id);
    return [client.name, client.email, client.phone].join(" ").toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru").trim()) &&
      (!stage || (stage === "none" ? !matches.length : matches.some(item => item.stage === stage)));
  });
  return <>
    <div className="tools"><label className="search"><Search size={18} /><input placeholder="Имя, телефон или почта" aria-label="Поиск клиентов" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <select aria-label="Этап сделки" value={stage} onChange={event => setStage(event.target.value)}><option value="">Все этапы</option>{stages.map(item => <option key={item} value={item}>{stageName(labels, item)}</option>)}<option value="none">Без сделки</option></select>
      <button className="primary push" onClick={() => setModal(true)}><Plus size={17} /> Добавить клиента</button></div>
    <section className="card table-card">{!filtered.length ? <Empty>Клиенты не найдены</Empty> : <div className="table-scroll"><table><thead><tr><th>Клиент</th><th>Этап</th><th>Источник</th><th>Ответственный</th><th>Добавлен</th></tr></thead><tbody>
      {filtered.map(client => <tr key={client.id}><td><Link className="person" href={`/clients/${client.id}`}><Avatar name={client.name} /><span><strong>{client.name}</strong><small>{client.phone}</small></span></Link></td>
        <td>{deals.filter(deal => deal.clientId === client.id).map(deal => <StageBadge key={deal.id} labels={labels} stage={deal.stage} />)}{!deals.some(deal => deal.clientId === client.id) && "—"}</td>
        <td>{client.source}</td><td>{users.find(member => member.id === client.ownerId)?.name}</td><td>{date(client.createdAt)}</td></tr>)}
    </tbody></table></div>}</section>
    {modal && <Modal title="Добавить клиента" close={() => setModal(false)}><form onSubmit={async event => {
      const fields = Object.fromEntries(submit(event));
      if (!fields.ownerId) delete fields.ownerId;
      setBusy(true);
      try { await api("/clients", "POST", fields); setModal(false); await reload(); notify("Клиент добавлен"); }
      catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
    }}>
      <label>Имя и фамилия<input name="name" required maxLength={160} /></label><label>Телефон<input name="phone" type="tel" required minLength={5} maxLength={32} /></label><label>Электронная почта<input name="email" type="email" /></label>
      <label>Источник<select name="source"><option>Сайт школы</option><option>Рекомендация</option><option>Демо-чат</option></select></label>
      {user.role !== "manager" && <label>Ответственный<select name="ownerId"><option value="">По правилам распределения</option>{users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <button className="primary" disabled={busy}>Добавить</button>
    </form></Modal>}
  </>;
}
export function ClientDetail({ api, labels, users, user, id, notify }: ScreenProps & { id: string }) {
  const load = useCallback(() => api<{ client: Client; deals: Deal[]; tasks: Task[] }>(`/clients/${id}`), [api, id]);
  const { data, error, reload } = useData(load);
  const [modal, setModal] = useState<"deal" | "task">();
  const [busy, setBusy] = useState(false);
  if (!data || error) return <Pending error={error} reload={reload} />;
  const { client, deals, tasks } = data;
  return <>
    <section className="card panel"><div className="section-head"><div className="person"><Avatar name={client.name} /><div><h2>{client.name}</h2><p>{client.source} · {date(client.createdAt)}</p></div></div><Link href={`/chats?client=${client.id}`} className="secondary">Переписка <ArrowRight size={16} /></Link></div>
      <div className="contact"><span><Phone size={16} />{client.phone}</span>{client.email && <span><Mail size={16} />{client.email}</span>}
        {user.role === "manager" ? <span>{user.name}</span> : <label>Ответственный <select value={client.ownerId} disabled={busy} onChange={async event => {
          setBusy(true);
          try { await api(`/clients/${id}`, "PATCH", { ownerId: event.target.value }); await reload(); notify("Ответственный изменён"); }
          catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
        }}>{users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    </section>
    <div className="dash-grid">
      <section className="card panel"><div className="section-head"><h2>Сделки</h2><button className="secondary" onClick={() => setModal("deal")}><Plus size={16} /> Сделка</button></div>
        {deals.length ? deals.map(deal => <div className="task-row" key={deal.id}><strong>{deal.title}</strong><StageBadge labels={labels} stage={deal.stage} /><span>{money(deal.amount)}</span></div>) : <Empty>У клиента пока нет сделок</Empty>}</section>
      <section className="card panel"><div className="section-head"><h2>Задачи</h2><button className="secondary" onClick={() => setModal("task")}><Plus size={16} /> Задача</button></div>
        {tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} />) : <Empty>У клиента пока нет задач</Empty>}</section>
    </div>
    {modal && <Modal title={modal === "deal" ? "Новая сделка" : "Новая задача"} close={() => setModal(undefined)}><form onSubmit={async event => {
      const fields = submit(event);
      setBusy(true);
      try {
        const common = { clientId: id, title: fields.get("title") };
        if (modal === "deal") await api("/deals", "POST", { ...common, amount: Number(fields.get("amount")), stage: fields.get("stage") });
        else await api("/tasks", "POST", { ...common, dueAt: new Date(String(fields.get("dueAt")) + "T18:00:00+05:00").toISOString() });
        setModal(undefined); await reload(); notify("Запись добавлена");
      } catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
    }}><label>Название<input name="title" required maxLength={160} /></label>
      {modal === "deal" ? <><label>Сумма, ₸<input name="amount" type="number" min="0" max="1000000000" required /></label><label>Этап<select name="stage">{stages.map(item => <option key={item} value={item}>{stageName(labels, item)}</option>)}</select></label></> : <label>Срок<input name="dueAt" type="date" required /></label>}
      <button className="primary" disabled={busy}>Сохранить</button></form></Modal>}
  </>;
}
const stageColors = ["#5174e2", "#9367d9", "#da8a3c", "#207da8", "#2ba481", "#de6878"];
function Column({ stage, children }: { stage: Stage; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return <section ref={setNodeRef} className={`column ${isOver ? "over" : ""}`} style={{ borderTopColor: stageColors[stages.indexOf(stage)] }}>{children}</section>;
}
function DealCard({ deal, client, labels, change, busy }: { deal: Deal; client?: Client; labels: string[]; change: (stage: Stage) => void; busy: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled: busy });
  return <article ref={setNodeRef} className={`card deal ${isDragging ? "dragging" : ""}`}>
    <div className="section-head"><strong>{deal.title}</strong><button className="icon grip" title="Перетащить сделку" aria-label="Перетащить сделку" {...attributes} {...listeners}><GripVertical size={16} /></button></div>
    <Link href={`/clients/${deal.clientId}`}>{client?.name ?? "Клиент"}</Link><b>{money(deal.amount)}</b>
    <select aria-label={`Этап сделки «${deal.title}»`} value={deal.stage} disabled={busy} onChange={event => change(event.target.value as Stage)}>{stages.map(item => <option key={item} value={item}>{stageName(labels, item)}</option>)}</select>
  </article>;
}
export function Deals({ api, labels, notify }: ScreenProps) {
  const load = useCallback(() => Promise.all([api<Deal[]>("/deals"), api<Client[]>("/clients")]), [api]);
  const { data, error, reload, setData } = useData(load);
  const [dragged, setDragged] = useState<string>();
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  if (!data || error) return <Pending error={error} reload={reload} />;
  const [deals, clients] = data;
  async function move(deal: Deal, stage: Stage) {
    if (deal.stage === stage || busy) return;
    setBusy(true);
    try {
      const saved = await api<Deal>(`/deals/${deal.id}`, "PATCH", { stage });
      setData([deals.map(item => item.id === saved.id ? saved : item), clients]);
      notify("Этап сделки изменён");
    } catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
  }
  function end(event: DragEndEvent) {
    setDragged(undefined);
    const deal = deals.find(item => item.id === event.active.id);
    if (deal && event.over) void move(deal, event.over.id as Stage);
  }
  const overlay = deals.find(item => item.id === dragged);
  return <><div className="tools"><Link href="/chats" className="secondary">Переписки <ArrowRight size={16} /></Link><span className="muted">Чтобы добавить сделку, откройте карточку клиента.</span></div>
    <DndContext sensors={sensors} onDragStart={event => setDragged(String(event.active.id))} onDragEnd={end} onDragCancel={() => setDragged(undefined)}>
      <div className="board">{stages.map(stage => {
        const cards = deals.filter(item => item.stage === stage);
        return <Column stage={stage} key={stage}><div className="column-title"><strong>{stageName(labels, stage)}</strong><span>{cards.length}</span></div><p>{money(cards.reduce((sum, item) => sum + item.amount, 0))}</p>
          {cards.length ? cards.map(item => <DealCard key={item.id} deal={item} client={clients.find(client => client.id === item.clientId)} labels={labels} busy={busy} change={stage => void move(item, stage)} />) : <div className="drop-empty">Нет сделок</div>}</Column>;
      })}</div>
      <DragOverlay>{overlay && <div className="card deal"><strong>{overlay.title}</strong><b>{money(overlay.amount)}</b></div>}</DragOverlay>
    </DndContext></>;
}
export function Tasks({ api, notify }: ScreenProps) {
  const load = useCallback(() => api<Task[]>("/tasks"), [api]);
  const { data, error, reload, setData } = useData(load);
  const [filter, setFilter] = useState("all");
  if (!data || error) return <Pending error={error} reload={reload} />;
  const filtered = [...data].filter(item => filter === "all" || (filter === "done" ? item.done : !item.done)).sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt.localeCompare(b.dueAt));
  return <section className="card panel"><div className="section-head"><h2><CalendarDays size={18} /> Список задач</h2><div className="segmented">{[["all", "Все"], ["open", "Открытые"], ["done", "Выполненные"]].map(([id, name]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{name}</button>)}</div></div>
    {filtered.length ? filtered.map(task => <TaskRow task={task} key={task.id} onChange={async () => {
      try { const saved = await api<Task>(`/tasks/${task.id}`, "PATCH", { done: !task.done }); setData(previous => previous?.map(item => item.id === saved.id ? saved : item)); notify(saved.done ? "Задача выполнена" : "Задача снова открыта"); }
      catch (reason) { notify((reason as Error).message, true); }
    }} />) : <Empty>В этом разделе задач нет</Empty>}</section>;
}
