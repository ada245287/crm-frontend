"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";
import { ArrowLeft, ArrowRight, Bot, CalendarDays, CloudSun, MapPin, Moon, Plus, Send, Settings2, Sun, Sunrise, Sunset, Trash2, Users } from "lucide-react";
import { clock, roles, today, type Article, type Chat, type Message, type Settings, type User } from "../lib/crm";
import { Avatar, Empty, Modal, submit } from "./ui";
import { Pending, useData } from "./sales";
import type { ScreenProps } from "./workspace";

function Messages({ messages }: { messages: Message[] }) {
  return <div className="messages">{messages.length ? messages.map(message => <div className={`bubble ${message.from}`} key={message.id}>
    <small>{message.from === "client" ? "Клиент" : message.from === "bot" ? "Ночной бот" : "Менеджер"} · {clock(message.at)}</small><p>{message.text}</p>
  </div>) : <Empty>Здесь появятся сообщения клиента</Empty>}</div>;
}
type History = { id: string; client: string; messages: Message[] };
export function Chats({ api, user, users, notify }: ScreenProps) {
  const [owner, setOwner] = useState("");
  const [active, setActive] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [day, setDay] = useState(today);
  const [draft, setDraft] = useState("");
  const [incoming, setIncoming] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Chat[]>("/chats"), [api]);
  const { data, error, reload, setData } = useData(load);
  const historyOwner = owner || user.id;
  const loadHistory = useCallback(() => history && day
    ? api<History[]>(`/history?${new URLSearchParams({ ownerId: historyOwner, date: day })}`)
    : Promise.resolve([]), [api, history, historyOwner, day]);
  const archive = useData(loadHistory);
  useEffect(() => {
    const client = new URLSearchParams(location.search).get("client");
    if (client) { setActive(client); setMobileOpen(true); }
  }, []);
  useEffect(() => { const timer = setInterval(reload, 4000); return () => clearInterval(timer); }, [reload]);
  const firstId = data?.find(chat => !owner || chat.ownerId === owner)?.id;
  useEffect(() => { if (!active && firstId) setActive(firstId); }, [active, firstId]);
  if (!data || error) return <Pending error={error} reload={reload} />;
  const filtered = data.filter(chat => !owner || chat.ownerId === owner);
  const selected = filtered.find(chat => chat.id === active) ?? filtered[0];
  const choose = async (chat: Chat) => {
    setActive(chat.id); setMobileOpen(true); setDraft("");
    if (!chat.unread) return;
    try {
      await api(`/chats/${chat.id}/read`, "PATCH");
      setData(previous => previous?.map(item => item.id === chat.id ? { ...item, unread: false } : item));
    } catch (reason) { notify((reason as Error).message, true); }
  };
  const send = async (text: string, from: "client" | "manager") => {
    if (!selected || !text.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/chats/${selected.id}/messages`, "POST", { text, from });
      if (from === "client") setIncoming(false);
      else setDraft("");
      await reload();
    } catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
  };
  return <>
    <div className="tools"><Link href="/deals" className="secondary">Воронка <ArrowRight size={16} /></Link>
      {user.role !== "manager" && <select aria-label="Ответственный" value={owner} onChange={event => { setOwner(event.target.value); setActive(""); setDraft(""); setMobileOpen(false); }}><option value="">Все менеджеры</option>{users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      <button className="secondary push" onClick={() => setHistory(!history)}><CalendarDays size={16} />{history ? "К перепискам" : "История за день"}</button></div>
    {history ? <section className="card panel"><div className="section-head"><div><h2>История за день</h2><p>{users.find(item => item.id === historyOwner)?.name} · Время Алматы</p></div><input type="date" aria-label="Дата истории" value={day} onChange={event => setDay(event.target.value)} /></div>
      {!archive.data || archive.error ? <Pending error={archive.error} reload={archive.reload} /> :
        archive.data.length ? archive.data.map(group => <details key={group.id}><summary>{group.client} · {group.messages.length}</summary><Messages messages={group.messages} /></details>) : <Empty>За выбранный день сообщений нет</Empty>}
    </section> : <section className={`card chat-grid ${mobileOpen && selected ? "mobile-chat" : ""}`}>
      <div className="chat-list"><h2>Входящие <span>{filtered.filter(item => item.unread).length} новых</span></h2>
        {filtered.length ? filtered.map(chat => <button className={`chat-item ${selected?.id === chat.id ? "current" : ""}`} key={chat.id} onClick={() => void choose(chat)}>
          <Avatar name={chat.client.name} /><span><strong>{chat.client.name}</strong><small>{chat.messages.at(-1)?.text ?? "Нет сообщений"}</small></span><span className="chat-time">{chat.messages.length ? clock(chat.messages.at(-1)!.at) : ""}{chat.unread && <i />}</span>
        </button>) : <Empty>Переписок нет</Empty>}</div>
      {selected ? <div className="thread"><div className="thread-head"><button className="icon chat-back" onClick={() => setMobileOpen(false)} aria-label="К списку чатов"><ArrowLeft size={20} /></button><Avatar name={selected.client.name} /><div><Link href={`/clients/${selected.id}`}><strong>{selected.client.name}</strong></Link><small>{selected.handoff ? "Ночной бот · ожидает передачи" : users.find(item => item.id === selected.ownerId)?.name}</small></div><button className="secondary push" disabled={busy} onClick={() => setIncoming(true)}>Входящее демо</button></div>
        <Messages messages={selected.messages} />
        <form className="composer" onSubmit={event => { event.preventDefault(); void send(draft, "manager"); }}>
          <input placeholder={user.canReply ? "Напишите клиенту…" : "Ответы отключены"} value={draft} aria-label="Сообщение" maxLength={4000} disabled={!user.canReply} onChange={event => setDraft(event.target.value)} />
          <button className="primary" aria-label="Отправить сообщение" disabled={!user.canReply || busy || !draft.trim()}><Send size={17} /></button>
        </form>
      </div> : <Empty>Откройте переписку</Empty>}
    </section>}
    {incoming && <Modal title="Входящее демо-сообщение" close={() => setIncoming(false)}><form onSubmit={event => { const data = submit(event); void send(String(data.get("message")), "client"); }}><label>Текст от клиента<textarea name="message" required maxLength={4000} defaultValue="Здравствуйте! Можно записаться на пробный урок?" /></label><button className="primary" disabled={busy}>Добавить входящее</button></form></Modal>}
  </>;
}

const locations = {
  "Казахстан": [
    { name: "Алматы", lat: 43.2389, lng: 76.8897, tz: "Asia/Almaty" },
    { name: "Астана", lat: 51.1694, lng: 71.4491, tz: "Asia/Almaty" },
    { name: "Шымкент", lat: 42.3155, lng: 69.5869, tz: "Asia/Almaty" },
    { name: "Актау", lat: 43.65, lng: 51.16, tz: "Asia/Aqtau" },
  ],
  "Узбекистан": [
    { name: "Ташкент", lat: 41.2995, lng: 69.2401, tz: "Asia/Tashkent" },
    { name: "Самарканд", lat: 39.6542, lng: 66.9597, tz: "Asia/Samarkand" },
  ],
  "Кыргызстан": [{ name: "Бишкек", lat: 42.8746, lng: 74.5698, tz: "Asia/Bishkek" }],
  "ОАЭ": [{ name: "Дубай", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" }],
  "Саудовская Аравия": [{ name: "Мекка", lat: 21.3891, lng: 39.8579, tz: "Asia/Riyadh" }],
};
type Country = keyof typeof locations;
export function Prayer({ user }: ScreenProps) {
  const [country, setCountry] = useState<Country>("Казахстан");
  const [city, setCity] = useState("Алматы");
  const [current, setCurrent] = useState<Date>();
  const key = `nahr-prayer-${user.id}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      if (Object.hasOwn(locations, saved.country)) {
        const country = saved.country as Country;
        if (locations[country].some(item => item.name === saved.city)) { setCountry(country); setCity(saved.city); }
      }
    } catch { /* Reset malformed demo preferences. */ }
    setCurrent(new Date());
    const timer = setInterval(() => setCurrent(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [key]);
  const location = locations[country].find(item => item.name === city) ?? locations[country][0];
  const calendar = current && new Intl.DateTimeFormat("sv-SE", { timeZone: location.tz }).format(current);
  const [year, month, day] = (calendar ?? "2000-01-01").split("-").map(Number);
  const params = country === "Саудовская Аравия" ? CalculationMethod.UmmAlQura() : CalculationMethod.MuslimWorldLeague();
  params.madhab = Madhab.Hanafi;
  const times = current && new PrayerTimes(new Coordinates(location.lat, location.lng), new Date(year, month - 1, day, 12), params);
  const options = [
    { name: "Фаджр", date: times?.fajr, icon: Sunrise },
    { name: "Зухр", date: times?.dhuhr, icon: Sun },
    { name: "Аср", date: times?.asr, icon: CloudSun },
    { name: "Магриб", date: times?.maghrib, icon: Sunset },
    { name: "Иша", date: times?.isha, icon: Moon },
  ];
  const next = options.find(item => item.date && current && item.date > current)?.name;
  function save(country: Country, city: string) {
    setCountry(country); setCity(city); localStorage.setItem(key, JSON.stringify({ country, city }));
  }
  return <section className="card panel prayer"><div className="section-head"><div><h2><MapPin size={20} /> {location.name}</h2><p>{current && new Intl.DateTimeFormat("ru-RU", { dateStyle: "full", timeZone: location.tz }).format(current)}</p></div></div>
    <div className="tools"><label>Страна <select value={country} onChange={event => { const value = event.target.value as Country; save(value, locations[value][0].name); }}>{Object.keys(locations).map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Город <select value={city} onChange={event => save(country, event.target.value)}>{locations[country].map(item => <option key={item.name}>{item.name}</option>)}</select></label></div>
    <div className="prayer-grid">{options.map(({ name, date, icon: Icon }) => <section className={next === name ? "next-prayer" : ""} key={name}><Icon size={22} /><span>{name}</span><strong>{date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: location.tz }).format(date) : "—"}</strong>{next === name && <small>Следующий</small>}</section>)}</div>
    <p className="muted">Расчёт по координатам · {country === "Саудовская Аравия" ? "Умм аль-Кура" : "Всемирная исламская лига"} · Ханафитский мазхаб</p>
  </section>;
}

const kinds = { knowledge: "База знаний", script: "Скрипт", course: "Курс" };
export function Admin({ api, users, user, notify, refresh }: ScreenProps) {
  const load = useCallback(() => Promise.all([api<Settings>("/settings"), api<Article[]>("/articles")]), [api]);
  const { data, error, reload } = useData(load);
  const [member, setMember] = useState<User | "new">();
  const [article, setArticle] = useState<Article | "new">();
  const [busy, setBusy] = useState(false);
  if (!data || error) return <Pending error={error} reload={reload} />;
  const [settings, articles] = data;
  async function update(action: () => Promise<unknown>, success: string, close?: () => void) {
    setBusy(true);
    try { await action(); close?.(); await reload(); refresh(); notify(success); }
    catch (reason) { notify((reason as Error).message, true); } finally { setBusy(false); }
  }
  const account = member === "new" ? undefined : member;
  const material = article === "new" ? undefined : article;
  return <>
    <section className="card panel"><div className="section-head"><h2><Settings2 size={18} /> Правила работы</h2></div>
      <form className="admin-settings" onSubmit={event => {
        const fields = submit(event);
        void update(() => api("/settings", "PATCH", {
          enabled: fields.has("enabled"), autoAssign: fields.has("autoAssign"), start: Number(fields.get("start")),
          end: Number(fields.get("end")), labels: settings.labels.map((_, index) => fields.get(`stage-${index}`)),
        }), "Настройки сохранены");
      }}>
        <div className="form-row"><label className="inline"><input name="autoAssign" type="checkbox" defaultChecked={settings.autoAssign} /> Автоматически распределять новые заявки</label><label className="inline"><input name="enabled" type="checkbox" defaultChecked={settings.enabled} /> Включить ночного бота</label></div>
        <div className="form-row"><label>С какого часа<input name="start" type="number" min="0" max="23" required defaultValue={settings.start} /></label><label>До какого часа<input name="end" type="number" min="0" max="23" required defaultValue={settings.end} /></label><p className="muted">Часовой пояс Алматы · целые часы</p></div>
        <div className="stage-settings">{settings.labels.map((name, i) => <label key={i}>Этап {i + 1}<input name={`stage-${i}`} required maxLength={160} defaultValue={name} /></label>)}</div>
        <button className="primary" disabled={busy}>Сохранить настройки</button>
      </form>
    </section>
    <section className="card table-card spaced"><div className="section-head panel"><h2><Users size={18} /> Сотрудники</h2><button className="secondary" onClick={() => setMember("new")}><Plus size={16} /> Добавить</button></div>
      <div className="table-scroll"><table><thead><tr><th>Имя</th><th>Роль</th><th>Получает заявки</th><th>Может отвечать</th><th>Действия</th></tr></thead><tbody>{users.map(item => <tr key={item.id}><td>{item.name}</td><td>{roles[item.role]}</td><td>{item.receiveLeads ? "Да" : "Нет"}</td><td>{item.canReply ? "Да" : "Нет"}</td>
        <td><button className="text-link" onClick={() => setMember(item)}>Изменить</button>{item.id !== user.id && <button className="icon" disabled={busy} aria-label={`Удалить ${item.name}`} onClick={() => {
          if (confirm(`Удалить сотрудника «${item.name}»? Его клиенты перейдут к вам.`)) void update(() => api(`/users/${item.id}`, "DELETE"), "Сотрудник удалён");
        }}><Trash2 size={16} /></button>}</td></tr>)}</tbody></table></div>
    </section>
    <section className="card panel spaced"><div className="section-head"><div><h2><Bot size={19} /> Материалы ночного бота</h2><p>Бот ищет ключевые слова и отвечает текстом материала.</p></div><button className="secondary" onClick={() => setArticle("new")}><Plus size={16} /> Добавить</button></div>
      {articles.length ? articles.map(item => <div className="task-row" key={item.id}><strong>{item.title}</strong><span>{kinds[item.kind as keyof typeof kinds]}</span><button className="text-link" onClick={() => setArticle(item)}>Изменить</button></div>) : <Empty>Материалов пока нет</Empty>}
    </section>
    {member && <Modal title={account ? "Редактировать сотрудника" : "Добавить сотрудника"} close={() => setMember(undefined)}><form onSubmit={event => {
      const fields = submit(event);
      void update(() => api(account ? `/users/${account.id}` : "/users", account ? "PATCH" : "POST", {
        name: fields.get("name"), role: fields.get("role"), receiveLeads: fields.has("receiveLeads"), canReply: fields.has("canReply"),
      }), "Сотрудник сохранён", () => setMember(undefined));
    }}><label>Имя<input name="name" required maxLength={160} defaultValue={account?.name} /></label><label>Роль<select name="role" defaultValue={account?.role ?? "manager"}>{Object.entries(roles).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="inline"><input name="receiveLeads" type="checkbox" defaultChecked={account?.receiveLeads ?? true} /> Получает заявки</label><label className="inline"><input name="canReply" type="checkbox" defaultChecked={account?.canReply ?? true} /> Может отвечать</label><button className="primary" disabled={busy}>Сохранить</button></form></Modal>}
    {article && <Modal title={material ? "Редактировать материал" : "Добавить материал"} close={() => setArticle(undefined)}><form onSubmit={event => {
      const fields = Object.fromEntries(submit(event));
      if (material && !confirm("Сохранить изменения? Ответы бота из старой версии материала исчезнут из истории.")) return;
      void update(() => api(material ? `/articles/${material.id}` : "/articles", material ? "PATCH" : "POST", fields), "Материал сохранён", () => setArticle(undefined));
    }}><label>Тип<select name="kind" defaultValue={material?.kind}>{Object.entries(kinds).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Название<input name="title" required maxLength={160} defaultValue={material?.title} /></label><label>Ключевые слова через запятую<input name="keywords" required maxLength={160} defaultValue={material?.keywords} /></label>
      <label>Ответ бота<textarea name="text" required maxLength={4000} defaultValue={material?.text} /></label><div className="form-row"><button className="primary" disabled={busy}>Сохранить</button>{material && <button type="button" className="secondary" disabled={busy} onClick={() => {
        if (confirm("Удалить этот материал базы знаний?")) void update(() => api(`/articles/${material.id}`, "DELETE"), "Материал удалён", () => setArticle(undefined));
      }}><Trash2 size={16} /> Удалить</button>}</div></form></Modal>}
  </>;
}
