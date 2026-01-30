"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Button, Input, Label, toast } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import {
  Upload,
  X,
  Loader2,
  ImageIcon,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  placeholder?: string;
  accept?: string;
  maxSizeMB?: number;
  aspectRatio?: "square" | "banner" | "auto";
  showPreview?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  folder = "uploads",
  label,
  placeholder = "Enter URL or upload a file",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  maxSizeMB = 4,
  aspectRatio = "auto",
  showPreview = true,
  className,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      // Validate file type
      const validTypes = accept.split(",").map((t) => t.trim());
      if (!validTypes.some((type) => file.type.match(type.replace("*", ".*")))) {
        toast.error("Invalid file type. Please upload an image.");
        return;
      }

      // Validate file size
      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      setIsUploading(true);

      try {
        const response = await fetch(
          `/api/admin/upload?filename=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`,
          {
            method: "POST",
            body: file,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const blob = await response.json();
        onChange(blob.url);
        toast.success("Image uploaded successfully");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to upload image");
      } finally {
        setIsUploading(false);
      }
    },
    [accept, folder, maxSizeMB, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [disabled, isUploading, handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleClear = useCallback(async () => {
    // Optionally delete from blob storage if it's a blob URL
    if (value.includes("blob.vercel-storage.com")) {
      try {
        await fetch(`/api/admin/upload?url=${encodeURIComponent(value)}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to delete blob:", error);
      }
    }
    onChange("");
  }, [value, onChange]);

  const aspectRatioClass = {
    square: "aspect-square",
    banner: "aspect-[3/1]",
    auto: "aspect-video",
  }[aspectRatio];

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}

      {/* Mode Toggle */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <Button
          type="button"
          variant={inputMode === "upload" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setInputMode("upload")}
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
        <Button
          type="button"
          variant={inputMode === "url" ? "default" : "ghost"}
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => setInputMode("url")}
        >
          <LinkIcon className="h-3 w-3 mr-1" />
          URL
        </Button>
      </div>

      {inputMode === "url" ? (
        /* URL Input Mode */
        <div className="flex gap-2">
          <Input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        /* Upload Mode */
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
            disabled && "opacity-50 pointer-events-none"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {value ? (
            /* Preview with current image */
            <div className={cn("relative overflow-hidden rounded-lg", aspectRatioClass)}>
              {showPreview && (
                <Image
                  src={value}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleClear}
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
          ) : (
            /* Upload dropzone */
            <div
              className={cn(
                "flex flex-col items-center justify-center p-8 cursor-pointer",
                aspectRatioClass
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-full bg-muted mb-3">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">
                    Drop an image here or click to upload
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max {maxSizeMB}MB · JPG, PNG, WebP, GIF
                  </p>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled || isUploading}
          />
        </div>
      )}

      {/* Show URL below preview */}
      {value && showPreview && inputMode === "upload" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate flex-1">{value}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("URL copied to clipboard");
            }}
          >
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}
