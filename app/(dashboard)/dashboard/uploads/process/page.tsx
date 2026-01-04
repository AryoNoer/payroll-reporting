/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================
// FILE 2: app/(dashboard)/dashboard/uploads/process/page.tsx
// UI untuk process file yang sudah ada di storage
// ============================================

"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle,
  FileText,
  Play,
  RefreshCw,
  Folder,
} from "lucide-react";

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  size: number;
}

interface FileList {
  HO: StorageFile[];
  OS: StorageFile[];
}

export default function ProcessStoragePage() {
  const [files, setFiles] = useState<FileList>({ HO: [], OS: [] });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [progress, setProgress] = useState<any>(null);

  // Load files from storage
  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/uploads/process-storage");
      const data = await res.json();
      setFiles(data.files);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Process single file
  const processFile = async (filePath: string, type: "HO" | "OS") => {
    setProcessing(filePath);
    setProgress({ chunk: 0, inserted: 0, message: "Starting..." });

    try {
      let chunkIndex = 0;
      let hasMore = true;
      let totalInserted = 0;

      while (hasMore) {
        setProgress({
          chunk: chunkIndex + 1,
          inserted: totalInserted,
          message: `Processing chunk ${chunkIndex + 1}...`,
        });

        const res = await fetch("/api/uploads/process-storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath: `${type}/${filePath}`,
            type,
            chunkIndex,
          }),
        });

        const result = await res.json();

        if (!result.success) {
          throw new Error(result.error || "Processing failed");
        }

        totalInserted += result.inserted;
        hasMore = result.hasMore;
        chunkIndex++;

        if (result.processed === 0) break;
      }

      setProgress({
        chunk: chunkIndex,
        inserted: totalInserted,
        message: `✅ Complete! ${totalInserted.toLocaleString()} rows inserted`,
      });

      setTimeout(() => {
        setProcessing(null);
        setProgress(null);
      }, 3000);
    } catch (error) {
      console.error("Processing error:", error);
      setProgress({
        message: `❌ Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Process Storage Files
          </h1>
          <p className="text-gray-600 mt-1">
            Process files yang sudah ada di Supabase Storage
          </p>
        </div>
        <button
          onClick={loadFiles}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Progress Modal */}
      {processing && progress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Processing File</h3>
                <p className="text-sm text-gray-600 mt-2">{progress.message}</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm">
                    <strong>Chunk:</strong> {progress.chunk}
                  </p>
                  <p className="text-sm">
                    <strong>Inserted:</strong>{" "}
                    {progress.inserted.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HO Files */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Folder className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-semibold">HO Files</h2>
          <span className="text-sm text-gray-500">
            ({files.HO.length} files)
          </span>
        </div>

        {files.HO.length === 0 ? (
          <p className="text-gray-500 text-sm">No files found in HO folder</p>
        ) : (
          <div className="space-y-2">
            {files.HO.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                      {new Date(file.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => processFile(file.name, "HO")}
                  disabled={processing === file.name}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {processing === file.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Process
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OS Files */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Folder className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-semibold">OS Files</h2>
          <span className="text-sm text-gray-500">
            ({files.OS.length} files)
          </span>
        </div>

        {files.OS.length === 0 ? (
          <p className="text-gray-500 text-sm">No files found in OS folder</p>
        ) : (
          <div className="space-y-2">
            {files.OS.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                      {new Date(file.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => processFile(file.name, "OS")}
                  disabled={processing === file.name}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {processing === file.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Process
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          📝 How to Upload Files
        </h3>
        <ol className="text-sm text-blue-800 space-y-1">
          <li>1. Buka Supabase Dashboard → Storage → payroll-components</li>
          <li>
            2. Upload file ke folder <strong>HO</strong> atau{" "}
            <strong>OS</strong>
          </li>
          <li>3. Refresh halaman ini</li>
          <li>4. Klik tombol &quot;Process&quot; untuk memproses file</li>
        </ol>
      </div>
    </div>
  );
}
