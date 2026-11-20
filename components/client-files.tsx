"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileAudio,
  Film,
  Images,
  Upload,
  X,
  RefreshCw,
  ShieldCheck,
  Paperclip,
} from "lucide-react";
import type { ScreenProps } from "./workspace";
import { Empty, Modal, Skeleton } from "./ui";
import {
  acceptedFiles,
  ClientFile,
  FileKind,
  FileLink,
  fileSize,
  inspectFile,
  uploadClientFile,
} from "../lib/files";
import { date } from "../lib/crm";
const kinds = { audio: "Голосовые", photo: "Фото", video: "Видео" };
function MediaFile({
  file,
  api,
  notify,
}: Pick<ScreenProps, "api" | "notify"> & { file: ClientFile }) {
  const [link, setLink] = useState<FileLink>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setLink(
        await api<FileLink>(`/clients/${file.clientId}/files/${file.id}/link`),
      );
    } catch (reason) {
      setLink(undefined);
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, file.id, file.clientId]);
  useEffect(() => {
    if (file.kind === "photo") void refresh();
  }, [file.kind, refresh]);
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(
      () => {
        setLink(undefined);
        setZoom(false);
      },
      Math.max(0, Date.parse(link.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [link]);
  const Icon =
    file.kind === "audio" ? FileAudio : file.kind === "video" ? Film : Images;
  return (
    <article
      className={"client-file " + (file.kind === "photo" ? "photo-file" : "")}
    >
      <div className="file-visual">
        {link ? (
          file.kind === "photo" ? (
            <button
              className="photo-button"
              onClick={() => setZoom(true)}
              aria-label={`Открыть фото ${file.name}`}
            >
              <img
                src={link.url}
                alt={file.name}
                loading="lazy"
                onError={() =>
                  setError("Не удалось открыть фото. Обновите ссылку.")
                }
              />
            </button>
          ) : file.kind === "audio" ? (
            <audio
              controls
              preload="none"
              src={link.url}
              aria-label={file.name}
              onError={() =>
                setError("Ссылка могла истечь. Обновите просмотр.")
              }
            />
          ) : (
            <video
              controls
              preload="metadata"
              playsInline
              src={link.url}
              aria-label={file.name}
              onError={() =>
                setError("Ссылка могла истечь. Обновите просмотр.")
              }
            />
          )
        ) : (
          <button
            className="file-open"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <Icon size={30} />
            <span>
              {busy
                ? "Открываем…"
                : file.kind === "audio"
                  ? "Слушать запись"
                  : file.kind === "video"
                    ? "Смотреть видео"
                    : "Открыть фото"}
            </span>
          </button>
        )}
      </div>
      <div className="file-caption">
        <strong title={file.name}>{file.name}</strong>
        <span>
          {fileSize(file.size)} · {date(file.createdAt)}
        </span>
        <button
          className="file-refresh"
          disabled={busy}
          onClick={() => void refresh()}
          aria-label={`Обновить ссылку: ${file.name}`}
        >
          <RefreshCw size={14} />
          Обновить просмотр
        </button>
      </div>
      {error && (
        <p className="file-error" role="alert">
          {error}
        </p>
      )}
      {zoom && link && (
        <Modal title={file.name} close={() => setZoom(false)}>
          <img className="photo-zoom" src={link.url} alt={file.name} />
        </Modal>
      )}
    </article>
  );
}
export function ClientFiles({
  id,
  api,
  notify,
}: Pick<ScreenProps, "api" | "notify"> & { id: string }) {
  const [files, setFiles] = useState<ClientFile[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState<FileKind | "all">("all");
  const [upload, setUpload] = useState<{
    name: string;
    percent: number;
    index: number;
    total: number;
  }>();
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    try {
      setFiles(await api<ClientFile[]>(`/clients/${id}/files`));
      setError("");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, id]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  async function start(selected: File[]) {
    if (controller.current || !selected.length) return;
    try {
      selected.forEach(inspectFile);
    } catch (reason) {
      notify((reason as Error).message, true);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    let success = 0;
    try {
      for (let i = 0; i < selected.length; i++) {
        if (abort.signal.aborted) break;
        const file = selected[i];
        setUpload({
          name: file.name,
          percent: 0,
          index: i + 1,
          total: selected.length,
        });
        await uploadClientFile(api, id, file, abort.signal, (percent) =>
          setUpload({
            name: file.name,
            percent: Math.round(percent),
            index: i + 1,
            total: selected.length,
          }),
        );
        success++;
      }
      if (success)
        notify(
          success === 1 ? "Файл добавлен" : `Добавлено файлов: ${success}`,
        );
    } catch (reason) {
      notify(
        (reason as Error).name === "AbortError"
          ? "Загрузка отменена"
          : (reason as Error).message,
        (reason as Error).name !== "AbortError",
      );
    } finally {
      controller.current = null;
      setUpload(undefined);
      if (input.current) input.current.value = "";
      await load();
    }
  }
  const shown = files.filter(
    (file) => filter === "all" || file.kind === filter,
  );
  return (
    <section className="client-files card panel">
      <div className="section-head">
        <div>
          <h2>
            <Paperclip size={20} />
            Файлы клиента <span className="file-count">{files.length}</span>
          </h2>
          <p>Голосовые, фотографии и видео в одном месте</p>
        </div>
        <button
          className="primary"
          disabled={!!upload || !!error}
          onClick={() => input.current?.click()}
        >
          <Upload size={17} />
          Загрузить файлы
        </button>
      </div>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        multiple
        accept={acceptedFiles}
        aria-label="Выбрать файлы клиента"
        onChange={(event) => void start(Array.from(event.target.files ?? []))}
      />
      <div
        className="file-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!upload && !error)
            void start(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="file-drop-icon">
          <Upload size={23} />
        </span>
        <div>
          <strong>Перетащите файлы сюда</strong>
          <p>
            OGG, MP3 — до 20 МБ · JPEG, PNG, WebP — до 10 МБ · MP4 — до 500 МБ
          </p>
        </div>
      </div>
      {upload && (
        <div className="file-upload-progress" role="status" aria-live="polite">
          <div>
            <strong>
              {upload.percent >= 97 ? "Проверяем и сохраняем…" : upload.name}
            </strong>
            <span>
              {upload.index} из {upload.total} · {upload.percent}%
            </span>
            <button
              className="icon"
              disabled={upload.percent >= 97}
              aria-label="Отменить загрузку"
              onClick={() => controller.current?.abort()}
            >
              <X size={18} />
            </button>
          </div>
          <progress
            max={100}
            value={upload.percent}
            aria-label="Прогресс загрузки"
          />
        </div>
      )}
      <div className="file-toolbar">
        <div className="segmented" role="group" aria-label="Тип файлов">
          {(["all", "audio", "photo", "video"] as const).map((kind) => (
            <button
              key={kind}
              aria-pressed={filter === kind}
              className={filter === kind ? "active" : ""}
              onClick={() => setFilter(kind)}
            >
              {kind === "all" ? "Все файлы" : kinds[kind]}
            </button>
          ))}
        </div>
        <span className="file-private">
          <ShieldCheck size={15} />
          Приватное хранилище
        </span>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="error" role="alert">
          {error}
          <button onClick={() => void load()}>Повторить</button>
        </div>
      ) : !shown.length ? (
        <Empty>
          {files.length
            ? "В этом разделе файлов пока нет"
            : "У клиента пока нет файлов. Загрузите первую запись, фото или видео."}
        </Empty>
      ) : (
        <div className="client-file-grid">
          {shown.map((file) => (
            <MediaFile key={file.id} file={file} api={api} notify={notify} />
          ))}
        </div>
      )}
      <p className="file-access-note">
        Ссылка на просмотр действует 15 минут. Обновить её могут только
        сотрудники с доступом к этому клиенту.
      </p>
    </section>
  );
}
