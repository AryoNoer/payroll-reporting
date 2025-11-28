// app/(dashboard)/dashboard/uploads/components/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Building2,
  MapPin,
  Calendar,
} from "lucide-react";

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

export default function UploadComponentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState<"HO" | "OS">("HO");
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<Modal>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastIdCounter = useRef(0);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        showToast("error", "Please select a CSV file");
        return;
      }

      if (selectedFile.size > 100 * 1024 * 1024) {
        showToast("error", "File size exceeds 100MB limit");
        return;
      }

      setFile(selectedFile);
      showToast("success", `File selected: ${selectedFile.name}`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast("warning", "Please select a file");
      return;
    }

    if (!selectedType) {
      showToast("warning", "Please select data type (HO or OS)");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", selectedType);

    try {
      const response = await fetch("/api/uploads/components", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        showModal(
          "error",
          "Upload Failed",
          data.error || "Failed to upload file",
          data.details
        );
        return;
      }

      showModal(
        "success",
        "File Uploaded Successfully!",
        `Your ${selectedType} file "${
          file.name
        }" has been processed successfully.\n\nTotal rows processed: ${
          data.count
        }\nType: ${selectedType === "HO" ? "Head Office" : "Operating Site"}`,
        undefined,
        () => {
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      );
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

            <div className="px-6 py-4">
              <p className="text-gray-700 whitespace-pre-line">
                {modal.message}
              </p>

              {modal.details && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800 font-medium">
                    View technical details
                  </summary>
                  <div className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-48">
                    <pre>{JSON.stringify(modal.details, null, 2)}</pre>
                  </div>
                </details>
              )}
            </div>

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
        <h1 className="text-3xl font-bold text-gray-900">
          Upload Components Data
        </h1>
        <p className="text-gray-600 mt-2">
          Upload CSV file untuk data komponen karyawan
        </p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upload New File
        </h2>

        <div className="space-y-6">
          {/* Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Data Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* HO Option */}
              <button
                type="button"
                onClick={() => setSelectedType("HO")}
                className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  selectedType === "HO"
                    ? "border-indigo-500 bg-indigo-50 shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    selectedType === "HO" ? "bg-indigo-600" : "bg-gray-300"
                  }`}
                >
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p
                    className={`font-semibold ${
                      selectedType === "HO"
                        ? "text-indigo-900"
                        : "text-gray-700"
                    }`}
                  >
                    Head Office
                  </p>
                  <p className="text-xs text-gray-500">HO Data</p>
                </div>
                {selectedType === "HO" && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  </div>
                )}
              </button>

              {/* OS Option */}
              <button
                type="button"
                onClick={() => setSelectedType("OS")}
                className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  selectedType === "OS"
                    ? "border-purple-500 bg-purple-50 shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    selectedType === "OS" ? "bg-purple-600" : "bg-gray-300"
                  }`}
                >
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p
                    className={`font-semibold ${
                      selectedType === "OS"
                        ? "text-purple-900"
                        : "text-gray-700"
                    }`}
                  >
                    Operating Site
                  </p>
                  <p className="text-xs text-gray-500">OS Data</p>
                </div>
                {selectedType === "OS" && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                  </div>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose whether this data is from Head Office (HO) or Operating
              Site (OS)
            </p>
          </div>

          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File <span className="text-red-500">*</span>
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
              Maximum file size: 100MB. Format: CSV only.
            </p>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading || !selectedType}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Uploading {selectedType} Data...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Upload {selectedType} File
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          📋 CSV File Requirements
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Must be in CSV format (.csv)</li>
          <li>
            • Required columns: Employee No, Komponen, Nilai, Bulan Report
          </li>
          <li>• Optional columns: Remark, Remark2, Remark3</li>
          <li>• Maximum file size: 100MB</li>
          <li>• Select correct Type (HO/OS) before uploading</li>
        </ul>
      </div>

      {/* Type Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-indigo-900 mb-1">
                Head Office (HO)
              </h4>
              <p className="text-sm text-indigo-800">
                Data karyawan yang bekerja di kantor pusat atau divisi corporate
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-purple-900 mb-1">
                Operating Site (OS)
              </h4>
              <p className="text-sm text-purple-800">
                Data karyawan yang bekerja di lokasi operasional atau site
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
