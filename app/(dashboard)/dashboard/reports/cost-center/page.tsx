"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ChevronLeft,
  FileText,
  CheckCircle,
  XCircle,
  BarChart3,
} from "lucide-react";

interface Upload {
  id: string;
  originalName: string;
  period: string;
  rowCount: number;
}

interface Toast {
  id: number;
  type: "success" | "error" | "warning";
  message: string;
}

export default function CostCenterReportPage() {
  const router = useRouter();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<string>("");
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    fetchUploads();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (
    type: "success" | "error" | "warning",
    message: string
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchUploads = async () => {
    try {
      const response = await fetch("/api/uploads?status=COMPLETED");
      const data = await response.json();
      setUploads(data);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      showToast("error", "Failed to load data sources");
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedUpload || !reportName) {
      showToast("warning", "Please select data source and enter report name");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: selectedUpload,
          name: reportName,
          description: reportDescription,
          reportType: "COST_CENTER",
          selectedFields: ["AGGREGATED"], // Special marker for aggregated report
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showToast(
          "success",
          `Cost Center report "${reportName}" created successfully!`
        );

        setTimeout(() => {
          router.push("/dashboard/reports");
        }, 1500);
      } else {
        const error = await response.json();
        showToast(
          "error",
          error.message || error.error || "Failed to create report"
        );
      }
    } catch (error) {
      console.error("Network error:", error);
      showToast("error", "Failed to connect to server");
    } finally {
      setGenerating(false);
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
                : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            )}
            {toast.type === "error" && (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                toast.type === "success"
                  ? "text-green-800"
                  : toast.type === "error"
                  ? "text-red-800"
                  : "text-yellow-800"
              }`}
            >
              {toast.message}
            </span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Cost Center Report
            </h1>
            <p className="text-gray-600 mt-1">
              Aggregated salary data by Directorate (COA 600 & 500)
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Select Data Source */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Select Data Source
            </h2>
            <div className="space-y-3">
              {uploads.map((upload) => (
                <label
                  key={upload.id}
                  className={`flex items-center space-x-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedUpload === upload.id
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="upload"
                    value={upload.id}
                    checked={selectedUpload === upload.id}
                    onChange={(e) => setSelectedUpload(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {upload.originalName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {upload.rowCount} employees • Period:{" "}
                      {new Date(upload.period).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "long",
                      })}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Report Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Report Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Cost Center October 2024"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Add notes or description"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateReport}
            disabled={!selectedUpload || !reportName || generating}
            className="w-full px-6 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-lg font-semibold"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Generating Report...
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5 mr-2" />
                Generate Cost Center Report
              </>
            )}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Report Preview
            </h3>

            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm font-medium text-indigo-900 mb-2">
                  Aggregation Structure
                </p>
                <div className="text-xs text-indigo-700 space-y-1">
                  <div className="bg-white px-3 py-2 rounded">
                    <strong>COA 600:</strong> Kantor Pusat
                  </div>
                  <div className="bg-white px-3 py-2 rounded">
                    <strong>COA 500:</strong> Cabang
                  </div>
                  <div className="bg-white px-3 py-2 rounded mt-2">
                    ↳ <strong>Directorate:</strong> Dynamic columns
                  </div>
                  <div className="bg-white px-3 py-2 rounded">
                    ↳ <strong>Components:</strong> Basic Salary, Tunjangan, etc
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p>✓ Report Type: Cost Center (Aggregated)</p>
                <p>✓ Export Format: Excel (.xlsx)</p>
                <p>✓ Grouping: COA → Directorate</p>
                <p>✓ Metrics: Count + Sum per component</p>
                <p>
                  ✓ Data Source: {selectedUpload ? "Selected" : "Not selected"}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong>Note:</strong> This report aggregates salary data by
                  organizational structure. Directorates are dynamically
                  extracted from your source data. Components shown are those
                  with available data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
