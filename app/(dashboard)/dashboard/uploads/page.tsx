/* eslint-disable @typescript-eslint/no-explicit-any */

// app/(dashboard)/dashboard/uploads/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

interface UploadItem {
  id: string;
  fileName: string;
  originalName: string;
  rowCount: number;
  period: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  progress: number;
  uploadedAt: string;
  errorMessage?: string;
}

interface UploadError {
  message: string;
  code?: string;
  details?: any;
}

interface Toast {
  id: number;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

interface Modal {
  show: boolean;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  details?: any;
  onConfirm?: () => void;
}

export default function UploadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UploadError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<Modal>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });
  const toastIdCounter = useRef(0);

  useEffect(() => {
    fetchUploads();
  }, []);

  useEffect(() => {
    const processingUploads = uploads.filter((u) => u.status === "PROCESSING");

    if (processingUploads.length > 0) {
      pollingIntervalRef.current = setInterval(() => {
        pollProcessingUploads(processingUploads.map((u) => u.id));
      }, 2000);
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [uploads]);

  const showToast = (type: Toast["type"], message: string) => {
    const id = ++toastIdCounter.current;
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const showModal = (
    type: Modal["type"],
    title: string,
    message: string,
    details?: any,
    onConfirm?: () => void
  ) => {
    setModal({ show: true, type, title, message, details, onConfirm });
  };

  const closeModal = () => {
    setModal({ ...modal, show: false });
    if (modal.onConfirm) {
      modal.onConfirm();
    }
  };

  const pollProcessingUploads = async (uploadIds: string[]) => {
    try {
      const responses = await Promise.all(
        uploadIds.map((id) =>
          fetch(`/api/uploads/${id}/status`).then((res) => res.json())
        )
      );

      setUploads((prevUploads) =>
        prevUploads.map((upload) => {
          const updated = responses.find((r) => r.id === upload.id);
          if (updated) {
            if (
              upload.status === "PROCESSING" &&
              updated.status === "COMPLETED"
            ) {
              showToast(
                "success",
                `Processing completed for ${upload.originalName}`
              );
            } else if (
              upload.status === "PROCESSING" &&
              updated.status === "FAILED"
            ) {
              showToast(
                "error",
                `Processing failed for ${upload.originalName}`
              );
            }

            return {
              ...upload,
              status: updated.status,
              progress: updated.progress || 0,
              errorMessage: updated.errorMessage,
            };
          }
          return upload;
        })
      );
    } catch (err) {
      console.error("Polling error:", err);
    }
  };

  const fetchUploads = async () => {
    try {
      const response = await fetch("/api/uploads");

      if (!response.ok) {
        console.error("Failed to fetch uploads:", response.statusText);
        setUploads([]);
        return;
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setUploads(data);
      } else {
        console.error("Invalid response format:", data);
        setUploads([]);
      }
    } catch (err) {
      console.error("Error fetching uploads:", err);
      setUploads([]);
      showToast("error", "Failed to load upload history");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        showToast("error", "Please select a CSV file");
        return;
      }

      if (selectedFile.size > 20 * 1024 * 1024) {
        showToast("error", "File size exceeds 20MB limit");
        return;
      }

      setFile(selectedFile);
      setError(null);
      showToast("success", `File selected: ${selectedFile.name}`);
    }
  };

  const handleUpload = async () => {
    if (!file || !period) {
      showToast("warning", "Please select a file and period");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("period", period);

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // ✅ NEW: Show detailed error for duplicates
        if (data.code === "DUPLICATE_IN_FILE") {
          showModal(
            "error",
            "Duplicate Employees Found",
            data.error,
            data.details
          );
        } else {
          showModal(
            "error",
            "Upload Failed",
            data.error || "Failed to upload file",
            data.details
          );
        }
        
        setError({
          message: data.error || "Upload failed",
          code: data.code,
          details: data.details,
        });
        return;
      }

      // ✅ NEW: Show warning if duplicates with same period
      if (data.warning) {
        showModal(
          "warning",
          "File Uploaded with Warnings",
          `Your file "${file.name}" has been uploaded successfully.\n\n${data.warning.message}`,
          undefined,
          () => {
            setFile(null);
            setPeriod("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setTimeout(fetchUploads, 1000);
          }
        );
      } else {
        showModal(
          "success",
          "File Uploaded Successfully!",
          `Your file "${file.name}" has been uploaded and processing will start automatically.`,
          undefined,
          () => {
            setFile(null);
            setPeriod("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            setTimeout(fetchUploads, 1000);
          }
        );
      }
    } catch (err) {
      showModal(
        "error",
        "Network Error",
        "Failed to connect to the server. Please check your connection and try again."
      );
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right duration-300 min-w-[300px] ${
              toast.type === "success"
                ? "bg-green-50 border border-green-200"
                : toast.type === "error"
                ? "bg-red-50 border border-red-200"
                : toast.type === "warning"
                ? "bg-yellow-50 border border-yellow-200"
                : "bg-blue-50 border border-blue-200"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            )}
            {toast.type === "error" && (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            {toast.type === "warning" && (
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            )}
            {toast.type === "info" && (
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                toast.type === "success"
                  ? "text-green-800"
                  : toast.type === "error"
                  ? "text-red-800"
                  : toast.type === "warning"
                  ? "text-yellow-800"
                  : "text-blue-800"
              }`}
            >
              {toast.message}
            </span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between ${
                modal.type === "success"
                  ? "bg-green-50 border-green-200"
                  : modal.type === "error"
                  ? "bg-red-50 border-red-200"
                  : modal.type === "warning"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <div className="flex items-center gap-3">
                {modal.type === "success" && (
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                )}
                {modal.type === "error" && (
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                )}
                {modal.type === "warning" && (
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  </div>
                )}
                {modal.type === "info" && (
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  </div>
                )}
                <h3
                  className={`text-lg font-semibold ${
                    modal.type === "success"
                      ? "text-green-900"
                      : modal.type === "error"
                      ? "text-red-900"
                      : modal.type === "warning"
                      ? "text-yellow-900"
                      : "text-blue-900"
                  }`}
                >
                  {modal.title}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <p className="text-gray-700 whitespace-pre-line">{modal.message}</p>

              {modal.details && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800 font-medium">
                    View technical details
                  </summary>
                  <div className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-48">
                    {/* ✅ Show duplicate list nicely */}
                    {modal.details.duplicates && (
                      <div className="space-y-1">
                        <p className="font-semibold mb-2">Duplicate Employee Numbers:</p>
                        {modal.details.duplicates.map((dup: string, idx: number) => (
                          <div key={idx} className="text-red-700">• {dup}</div>
                        ))}
                        {modal.details.message && (
                          <p className="mt-2 text-gray-600 italic">{modal.details.message}</p>
                        )}
                      </div>
                    )}
                    {!modal.details.duplicates && (
                      <pre>{JSON.stringify(modal.details, null, 2)}</pre>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={closeModal}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  modal.type === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : modal.type === "error"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : modal.type === "warning"
                    ? "bg-yellow-600 text-white hover:bg-yellow-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Data</h1>
        <p className="text-gray-600 mt-2">Upload CSV file untuk diproses</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Upload Error {error.code && `(${error.code})`}
              </h3>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>

              {error.details && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">
                    View details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <button onClick={() => setError(null)} className="ml-3 shrink-0">
              <X className="w-5 h-5 text-red-500 hover:text-red-700" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upload New File
        </h2>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <div className="flex items-center space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex-1 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-500 transition-colors"
              >
                <div className="text-center">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  {file ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Click to select CSV file
                    </p>
                  )}
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum file size: 20MB. Format: CSV only.
            </p>
          </div>

          {/* Period Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period (Month/Year)
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || !period || uploading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Uploading & Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Upload File
              </>
            )}
          </button>
        </div>
      </div>

      {/* Upload History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Upload History
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : uploads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No uploads yet. Upload your first CSV file above.
            </div>
          ) : (
            uploads.map((upload) => (
              <div
                key={upload.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {upload.originalName}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span>{upload.rowCount} rows</span>
                        <span>•</span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {format(new Date(upload.period), "MMMM yyyy")}
                        </span>
                        <span>•</span>
                        <span>
                          {format(
                            new Date(upload.uploadedAt),
                            "dd MMM yyyy HH:mm"
                          )}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {upload.status === "PROCESSING" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-indigo-600">
                              Processing...
                            </span>
                            <span className="text-sm font-semibold text-indigo-600">
                              {upload.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${upload.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {upload.errorMessage && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                          <p className="font-medium">⚠ Warning:</p>
                          <p>{upload.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {upload.status === "COMPLETED" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Completed
                      </span>
                    )}
                    {upload.status === "PROCESSING" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Processing
                      </span>
                    )}
                    {upload.status === "FAILED" && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        <XCircle className="w-4 h-4 mr-1" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          📋 CSV File Requirements
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Must be in CSV format (.csv)</li>
          <li>• Required columns: Name, Employee No</li>
          <li>• No duplicate Employee No within the same file</li>
          <li>• Duplicates with same period will be automatically skipped</li>
          <li>• Maximum file size: 20MB</li>
        </ul>
      </div>
    </div>
  );
}