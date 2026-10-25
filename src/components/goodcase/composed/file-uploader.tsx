import { useEffect, useRef, useState } from "react";
import { Button } from "../basic/button";
import { Progress } from "../basic/progress";

export type UploadItem = {
  id: string;
  file: File;
  state: "selected" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
};
export type UploadAdapter = (
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void },
) => Promise<void>;
export function FileUploader({
  onUpload,
  maxFiles = 3,
  maxBytes = 2 * 1024 * 1024,
  acceptedTypes = ["image/png", "image/jpeg", "image/svg+xml"],
}: {
  onUpload: UploadAdapter;
  maxFiles?: number;
  maxBytes?: number;
  acceptedTypes?: string[];
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const inputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);
  const countRef = useRef(0);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      controllers.current.forEach((controller) => controller.abort());
    };
  }, []);
  function add(files: FileList | File[]) {
    const added: UploadItem[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (countRef.current + added.length >= maxFiles) {
        errors.push(`최대 ${maxFiles}개까지 선택할 수 있습니다.`);
        break;
      }
      if (!acceptedTypes.includes(file.type)) {
        errors.push(`${file.name}: 지원하지 않는 파일 형식`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`${file.name}: 파일 크기 제한 초과`);
        continue;
      }
      added.push({
        id: crypto.randomUUID(),
        file,
        state: "selected",
        progress: 0,
      });
    }
    countRef.current += added.length;
    setItems((current) => [...current, ...added]);
    setError(errors.join(" · "));
  }
  async function upload(item: UploadItem) {
    if (controllers.current.has(item.id)) return;
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    function update(patch: Partial<UploadItem>) {
      if (isMounted.current)
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, ...patch } : entry,
          ),
        );
    }
    update({ state: "uploading", progress: 0, error: undefined });
    try {
      await onUpload(item.file, {
        signal: controller.signal,
        onProgress: (percent) =>
          update({ progress: Math.min(100, Math.max(0, percent)) }),
      });
      if (!controller.signal.aborted)
        update({ state: "success", progress: 100 });
    } catch (e) {
      if (!controller.signal.aborted)
        update({
          state: "error",
          error: e instanceof Error ? e.message : "업로드 실패",
        });
    } finally {
      controllers.current.delete(item.id);
    }
  }
  return (
    <div>
      <div
        className={`gc-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          add(e.dataTransfer.files);
        }}
      >
        <strong>파일을 놓거나 버튼으로 선택</strong>
        <span className="gc-muted">
          최대 {maxFiles}개 · 파일당 {Math.round(maxBytes / 1024 / 1024)}MB ·{" "}
          {acceptedTypes.join(", ")}
        </span>
        <input
          ref={inputRef}
          hidden
          tabIndex={-1}
          aria-label="파일 선택"
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          파일 선택
        </Button>
      </div>
      {error && (
        <p role="alert" className="gc-error">
          {error}
        </p>
      )}
      <ul className="gc-upload-list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.file.name}</strong>
              <p role="status">
                {item.state === "selected"
                  ? "선택됨 · 아직 업로드하지 않음"
                  : item.state === "success"
                    ? "업로드 완료"
                    : item.state === "error"
                      ? item.error
                      : `업로드 중 ${Math.round(item.progress)}%`}
              </p>
              {item.state === "uploading" && (
                <Progress
                  label={`${item.file.name} 업로드 진행률`}
                  value={item.progress}
                  size="thin"
                />
              )}
            </div>
            <div className="gc-actions">
              {item.state === "error" && (
                <Button variant="secondary" onClick={() => upload(item)}>
                  재시도
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  controllers.current.get(item.id)?.abort();
                  controllers.current.delete(item.id);
                  countRef.current--;
                  setItems((current) =>
                    current.filter((entry) => entry.id !== item.id),
                  );
                }}
              >
                제거
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="primary"
        disabled={!items.some((item) => item.state === "selected")}
        onClick={() =>
          items
            .filter((item) => item.state === "selected")
            .forEach((item) => {
              void upload(item);
            })
        }
      >
        선택한 파일 업로드
      </Button>
    </div>
  );
}
