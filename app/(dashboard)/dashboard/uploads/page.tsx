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
} from "lucide-react";
import { format } from "date-fns";

interface UploadItem {
  id: string;
  fileName: string;
  originalName: string;
  rowCount: number;
  period: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  uploadedAt: string;
  errorMessage?: string;
}

interface UploadError {
  message: string;
  code?: string;
  details?: any;
}

export default function UploadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UploadError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      const response = await fetch("/api/uploads");

      if (!response.ok) {
        console.error("Failed to fetch uploads:", response.statusText);
        setUploads([]);
        return;
      }

      const data = await response.json();

      // Validate response is array
      if (Array.isArray(data)) {
        setUploads(data);
      } else {
        console.error("Invalid response format:", data);
        setUploads([]);

        // Show error if response contains error message
        if (data.error) {
          setError({
            message: "Failed to load uploads: " + data.error,
            code: "FETCH_ERROR",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching uploads:", err);
      setUploads([]);
      setError({
        message: "Failed to load upload history",
        code: "NETWORK_ERROR",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        setError({
          message: "Please select a CSV file",
          code: "INVALID_FILE_TYPE",
        });
        return;
      }

      // Check file size (max 20MB)
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError({
          message: "File size exceeds 20MB limit",
          code: "FILE_TOO_LARGE",
        });
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !period) {
      setError({
        message: "Please select a file and period",
        code: "MISSING_INPUTS",
      });
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
        setError({
          message: data.error || "Upload failed",
          code: data.code,
          details: data.details,
        });
        return;
      }

      // Success
      alert("File uploaded successfully! Processing in background...");
      setFile(null);
      setPeriod("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh upload list
      setTimeout(fetchUploads, 1000);
    } catch (err) {
      setError({
        message: "Network error. Please try again.",
        code: "NETWORK_ERROR",
      });
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
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
              Maximum file size: 10MB. Format: CSV only.
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
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
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
          <li>• Maximum file size: 10MB</li>
          <li>• Check terminal/console for detailed error logs</li>
        </ul>
      </div>
    </div>
  );
}
