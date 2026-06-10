"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";

/**
 * Photographer portal uploader: generous drop zone, per-file progress, and a
 * confirmation summary once a batch completes.
 */
export function PortalUploader({ token }: { token: string }) {
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <CheckCircle2
          className="mx-auto size-8 text-foreground"
          strokeWidth={1.5}
        />
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {totalUploaded} photo{totalUploaded === 1 ? "" : "s"} delivered
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you! The Soteria team has your photos. Tagging and indexing
          run automatically — you&apos;re all done.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setConfirmed(false)}
        >
          Upload more
        </Button>
      </div>
    );
  }

  return (
    <div>
      <UploadDropzone
        intent={{ intent: "portal-photo", uploadToken: token }}
        prompt="Drag photos here, or click to browse — JPEG, PNG, WebP"
        refreshOnDone={false}
        onAllDone={(succeeded) => {
          if (succeeded > 0) {
            setTotalUploaded((current) => current + succeeded);
            setConfirmed(true);
          }
        }}
      />
      {totalUploaded > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {totalUploaded} uploaded so far in this session
        </p>
      ) : null}
    </div>
  );
}
