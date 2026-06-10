"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// Mirrors lib/upload-intents.ts (kept local — that module is server-only).
export type UploadIntent =
  | { intent: "photo"; folderId: string }
  | { intent: "portal-photo"; uploadToken: string }
  | { intent: "kit-file"; kitId: string; sectionId?: string }
  | { intent: "kit-cover"; kitId: string }
  | { intent: "kit-source"; kitId: string };

interface FileUploadState {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

function xhrSend(
  method: string,
  url: string,
  body: FormData | File,
  onProgress: (percent: number) => void,
  contentType?: string
): Promise<{ ok: boolean; status: number; responseText: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        responseText: xhr.responseText,
      })
    );
    xhr.addEventListener("error", () =>
      resolve({ ok: false, status: 0, responseText: "" })
    );
    xhr.send(body);
  });
}

function errorFrom(responseText: string, status: number): string {
  try {
    const body = JSON.parse(responseText) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // fall through
  }
  return status === 0 ? "Network error" : `Upload failed (${status})`;
}

/**
 * Upload one file: ask the server for a presigned S3 URL (bypasses Vercel's
 * 4.5 MB body limit); if S3 isn't configured, fall back to the direct route.
 */
export async function uploadWithProgress(
  file: File,
  intent: UploadIntent,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; error?: string }> {
  const mimeType = file.type || "application/octet-stream";

  const presignResponse = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType,
      fileSize: file.size,
      intent,
    }),
  });
  if (!presignResponse.ok) {
    const text = await presignResponse.text();
    return { ok: false, error: errorFrom(text, presignResponse.status) };
  }
  const presign = (await presignResponse.json()) as
    | { mode: "direct" }
    | { mode: "s3"; url: string; key: string };

  if (presign.mode === "s3") {
    // Browser → S3, then register the upload.
    const put = await xhrSend("PUT", presign.url, file, onProgress, mimeType);
    if (!put.ok) {
      return { ok: false, error: "Storage upload failed — check S3 CORS configuration" };
    }
    const complete = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: presign.key,
        filename: file.name,
        mimeType,
        intent,
      }),
    });
    if (!complete.ok) {
      const text = await complete.text();
      return { ok: false, error: errorFrom(text, complete.status) };
    }
    return { ok: true };
  }

  // Local/dev fallback: file passes through the server route.
  const formData = new FormData();
  formData.set("file", file);
  for (const [key, value] of Object.entries(intent)) {
    if (value !== undefined) formData.set(key, String(value));
  }
  const direct = await xhrSend("POST", "/api/upload/direct", formData, onProgress);
  if (!direct.ok) {
    return { ok: false, error: errorFrom(direct.responseText, direct.status) };
  }
  return { ok: true };
}

export function UploadDropzone({
  intent,
  accept = "image/*",
  prompt = "Drag photos here, or click to browse",
  onAllDone,
  refreshOnDone = true,
  className,
}: {
  intent: UploadIntent;
  accept?: string;
  prompt?: string;
  onAllDone?: (succeeded: number) => void;
  refreshOnDone?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const busy = uploads.some((upload) => upload.status === "uploading");

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = [...fileList];
      if (files.length === 0) return;

      setUploads(
        files.map((file) => ({
          name: file.name,
          progress: 0,
          status: "uploading" as const,
        }))
      );

      let succeeded = 0;
      // Sequential keeps memory predictable for large batches.
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        const result = await uploadWithProgress(file, intent, (percent) => {
          setUploads((current) =>
            current.map((upload, uploadIndex) =>
              uploadIndex === index ? { ...upload, progress: percent } : upload
            )
          );
        });
        succeeded += result.ok ? 1 : 0;
        setUploads((current) =>
          current.map((upload, uploadIndex) =>
            uploadIndex === index
              ? {
                  ...upload,
                  progress: 100,
                  status: result.ok ? "done" : "error",
                  error: result.error,
                }
              : upload
          )
        );
        if (!result.ok) {
          toast.error(`${file.name}: ${result.error}`);
        }
      }

      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? "1 file uploaded" : `${succeeded} files uploaded`
        );
        if (refreshOnDone) router.refresh();
      }
      onAllDone?.(succeeded);
    },
    [intent, onAllDone, refreshOnDone, router]
  );

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-foreground bg-accent"
            : "border-border hover:border-muted-foreground/50",
          busy && "pointer-events-none opacity-60"
        )}
      >
        <UploadCloud
          className="size-5 text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="text-sm text-muted-foreground">{prompt}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {uploads.map((upload, index) => (
            <li key={`${upload.name}-${index}`} className="text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="truncate">{upload.name}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    upload.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {upload.status === "uploading"
                    ? `${upload.progress}%`
                    : upload.status === "done"
                      ? "Done"
                      : upload.error}
                </span>
              </div>
              {upload.status === "uploading" ? (
                <Progress value={upload.progress} className="mt-1 h-1" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
