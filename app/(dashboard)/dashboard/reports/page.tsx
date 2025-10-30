// app/(dashboard)/dashboard/reports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Loader2, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Report {
  id: string;
  name: string;
  description?: string;
  totalRecords: number;
  createdAt: string;
  upload: {
    originalName: string;
    period: string;
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/reports");
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (reportId: string, reportName: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading report:", error);
      alert("Failed to download report");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-2">
            Generate and manage payroll reports
          </p>
        </div>
        <Link
          href="/dashboard/reports/create"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Report
        </Link>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reports generated yet</p>
              <Link
                href="/dashboard/reports/create"
                className="inline-flex items-center mt-4 text-indigo-600 hover:text-indigo-700"
              >
                Create your first report
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {report.name}
                      </h3>
                      {report.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {report.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{report.totalRecords} records</span>
                        <span>•</span>
                        <span>Source: {report.upload.originalName}</span>
                        <span>•</span>
                        <span>
                          Period:{" "}
                          {format(new Date(report.upload.period), "MMMM yyyy")}
                        </span>
                        <span>•</span>
                        <span>
                          Created:{" "}
                          {format(new Date(report.createdAt), "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(report.id, report.name)}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
