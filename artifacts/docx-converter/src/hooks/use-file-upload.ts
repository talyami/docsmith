import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetConversionQueryKey, getListConversionsQueryKey } from "@workspace/api-client-react";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uploadFile = useCallback(async (file: File, useAi = false) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("useAi", useAi ? "true" : "false");

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload file");
      }

      const data = await response.json();
      
      // Invalidate the list so it updates immediately
      queryClient.invalidateQueries({ queryKey: getListConversionsQueryKey() });
      
      return data; // returns the conversion record
    } catch (err: any) {
      setUploadError(err.message || "An unexpected error occurred");
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [queryClient]);

  return {
    uploadFile,
    isUploading,
    uploadError,
  };
}
