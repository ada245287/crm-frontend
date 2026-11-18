"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Inbox, X } from "lucide-react";
import { initials } from "../lib/crm";

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden="true">{initials(name)}</span>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><Inbox size={25} />{children}</div>;
}
export function Skeleton() {
  return <div className="skeletons" role="status" aria-label="Загрузка">{[0, 1, 2, 3].map(i => <div key={i} />)}</div>;
}
export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="modal-body"><div className="section-head"><h2>{title}</h2><button className="icon" aria-label="Закрыть" onClick={close}><X size={20} /></button></div>{children}</div>
  </dialog>;
}
export function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
