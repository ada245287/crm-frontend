import type { Api } from "../components/workspace";
export type FileKind = "audio" | "photo" | "video";
export interface ClientFile {
  id: string;
  clientId: string;
  ownerId: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  createdAt: string;
}
export interface FileLink {
  url: string;
  expiresAt: string;
  expiresIn: number;
}
const rules = {
  "audio/ogg": { kind: "audio", max: 20 },
  "audio/mpeg": { kind: "audio", max: 20 },
  "image/jpeg": { kind: "photo", max: 10 },
  "image/png": { kind: "photo", max: 10 },
  "image/webp": { kind: "photo", max: 10 },
  "video/mp4": { kind: "video", max: 500 },
} as const;
export const acceptedFiles = Object.keys(rules).join(",");
export const fileSize = (size: number) =>
  new Intl.NumberFormat("ru", { maximumFractionDigits: 1 }).format(
    size / 1024 / 1024,
  ) + " МБ";
export function inspectFile(file: Pick<File, "type" | "size">) {
  const rule = rules[file.type as keyof typeof rules];
  if (!rule) throw new Error("Разрешены OGG, MP3, JPEG, PNG, WebP и MP4");
  if (file.size <= 0 || file.size > rule.max * 1024 * 1024)
    throw new Error(`Для этого формата допустимый размер — до ${rule.max} МБ`);
  return rule.kind;
}
function canceled() {
  return new DOMException("Загрузка отменена", "AbortError");
}
function check(signal: AbortSignal) {
  if (signal.aborted) throw canceled();
}
function put(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    check(signal);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 300_000;
    for (const [name, value] of Object.entries(headers))
      xhr.setRequestHeader(name, value);
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (event) => progress(event.loaded);
    xhr.onload = () => {
      cleanup();
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              "S3 отклонил загрузку. Проверьте CORS и права хранилища.",
            ),
          );
    };
    xhr.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Не удалось передать файл в S3. Проверьте соединение и CORS.",
        ),
      );
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("Истекло время загрузки части файла"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(canceled());
    };
    xhr.send(body);
  });
}
interface UploadStart {
  fileId: string;
  mode: "single" | "multipart";
  url?: string;
  headers?: Record<string, string>;
  partSize?: number;
  partCount?: number;
}
export async function uploadClientFile(
  api: Api,
  clientId: string,
  file: File,
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  const kind = inspectFile(file);
  const base = `/clients/${encodeURIComponent(clientId)}/files`;
  const local = new AbortController();
  const cancel = () => local.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) local.abort();
  let session: UploadStart | undefined;
  try {
    check(local.signal);
    session = await api<UploadStart>(base + "/uploads", "POST", {
      name: file.name,
      kind,
      mimeType: file.type,
      size: file.size,
    });
    check(local.signal);
    if (session.mode === "single") {
      await put(session.url!, file, session.headers ?? {}, local.signal, (n) =>
        progress(Math.min(95, (n / file.size) * 95)),
      );
    } else {
      const size = session.partSize!,
        count = session.partCount!;
      const loaded = new Array<number>(count).fill(0);
      let next = 0;
      const worker = async () => {
        while (next < count) {
          const index = next++;
          const chunk = file.slice(
            index * size,
            Math.min(file.size, (index + 1) * size),
          );
          for (let attempt = 0; attempt < 3; attempt++) {
            check(local.signal);
            try {
              const { url } = await api<{ url: string }>(
                `${base}/${session!.fileId}/parts/${index + 1}`,
                "POST",
              );
              check(local.signal);
              await put(url, chunk, {}, local.signal, (n) => {
                loaded[index] = n;
                progress(
                  Math.min(
                    95,
                    (loaded.reduce((sum, n) => sum + n, 0) / file.size) * 95,
                  ),
                );
              });
              loaded[index] = chunk.size;
              break;
            } catch (error) {
              if (local.signal.aborted || attempt === 2) throw error;
              loaded[index] = 0;
            }
          }
        }
      };
      const workers = Array.from({ length: Math.min(3, count) }, () =>
        worker(),
      );
      try {
        await Promise.all(workers);
      } catch (error) {
        local.abort();
        await Promise.allSettled(workers);
        throw error;
      }
    }
    check(local.signal);
    progress(97);
    // If the first response is lost, completion is safe to retry with the same file ID.
    let result: ClientFile | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await api<ClientFile>(
          `${base}/${session.fileId}/complete`,
          "POST",
        );
        break;
      } catch (error) {
        if (attempt === 2 || local.signal.aborted) throw error;
      }
    }
    progress(100);
    return result!;
  } catch (error) {
    if (session)
      await api(`${base}/${session.fileId}/abort`, "POST").catch(() => {});
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
