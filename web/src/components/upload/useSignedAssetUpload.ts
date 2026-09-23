import { useEffect, useRef, useState } from "react";

interface UseSignedAssetUploadParams {
  file: File | null;
  targetUrl: string;
  contentType: string;
}

export function useSignedAssetUpload({
  file,
  targetUrl,
  contentType,
}: UseSignedAssetUploadParams) {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadPromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!file) {
      setIsUploading(false);
      setIsUploaded(false);
      setUploadError(null);
      uploadPromiseRef.current = null;
      return;
    }

    const controller = new AbortController();

    async function uploadSelectedFile() {
      setIsUploading(true);
      setIsUploaded(false);
      setUploadError(null);

      try {
        const response = await fetch(targetUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": contentType,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`upload failed with status ${response.status}`);
        }

        setIsUploaded(true);
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return false;
        }

        const message = err instanceof Error ? err.message : String(err);
        setUploadError(message);
        return false;
      } finally {
        if (!controller.signal.aborted) {
          setIsUploading(false);
        }
      }
    }

    const uploadPromise = uploadSelectedFile();
    uploadPromiseRef.current = uploadPromise;

    return () => {
      controller.abort();
    };
  }, [contentType, file, targetUrl]);

  async function waitForUpload() {
    if (isUploaded) {
      return true;
    }

    const uploadPromise = uploadPromiseRef.current;
    if (!uploadPromise) {
      return false;
    }

    return uploadPromise;
  }

  function clearUploadError() {
    setUploadError(null);
  }

  return {
    isUploading,
    isUploaded,
    uploadError,
    clearUploadError,
    waitForUpload,
  };
}
