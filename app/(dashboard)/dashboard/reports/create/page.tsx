// app/(dashboard)/dashboard/reports/create/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ChevronLeft, FileText } from "lucide-react";

interface Upload {
  id: string;
  originalName: string;
  period: string;
  rowCount: number;
}

interface Component {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function CreateReportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Select upload
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<string>("");

  // Step 2: Select fields
  const [components, setComponents] = useState<Component[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Step 3: Configure report
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  // Fetch available fields when upload is selected
  useEffect(() => {
    if (selectedUpload && step === 2) {
      fetchAvailableFields();
    }
  }, [selectedUpload, step]);

  const fetchUploads = async () => {
    try {
      const response = await fetch("/api/uploads?status=COMPLETED");
      const data = await response.json();
      setUploads(data);
    } catch (error) {
      console.error("Error fetching uploads:", error);
    }
  };

  const fetchAvailableFields = async () => {
    if (!selectedUpload) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/uploads/${selectedUpload}/fields`);
      const data = await response.json();

      // Flatten all categorized fields into single array
      const allFields: Component[] = [
        ...(data.salary || []),
        ...(data.allowance || []),
        ...(data.deduction || []),
        ...(data.neutral || []),
      ];

      console.log(`✅ Loaded ${allFields.length} available fields from upload`);
      setComponents(allFields);
    } catch (error) {
      console.error("Error fetching available fields:", error);
      fetchMasterComponents();
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterComponents = async () => {
    try {
      const response = await fetch("/api/components");
      const data = await response.json();
      setComponents(data);
    } catch (error) {
      console.error("Error fetching components:", error);
    }
  };

  const filteredComponents = components.filter((comp) => {
    const matchesSearch =
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "ALL" || comp.type === selectedType;
    return matchesSearch && matchesType;
  });

  // ✅ FIX: Toggle by field NAME, not CODE
  const toggleField = (fieldName: string) => {
    const newSet = new Set(selectedFields);
    if (newSet.has(fieldName)) {
      newSet.delete(fieldName);
    } else {
      newSet.add(fieldName);
    }
    setSelectedFields(newSet);
    console.log(`Field toggled: ${fieldName}. Total selected: ${newSet.size}`);
  };

  // ✅ FIX: Select all by field NAME
  const selectAll = () => {
    const allNames = filteredComponents.map((c) => c.name);
    setSelectedFields(new Set(allNames));
    console.log(`✅ Selected all: ${allNames.length} fields`);
  };

  const deselectAll = () => {
    setSelectedFields(new Set());
    console.log("✅ Cleared all selections");
  };

  const handleGenerateReport = async () => {
    if (!selectedUpload || selectedFields.size === 0 || !reportName) {
      alert("Please complete all fields");
      return;
    }

    console.log("=== GENERATING REPORT ===");
    console.log(`Upload ID: ${selectedUpload}`);
    console.log(`Report Name: ${reportName}`);
    console.log(`Selected Fields: ${selectedFields.size}`);
    console.log(`Sample fields:`, Array.from(selectedFields).slice(0, 10));

    setGenerating(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: selectedUpload,
          name: reportName,
          description: reportDescription,
          selectedFields: Array.from(selectedFields), // ✅ Field NAMES
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Report created:", result);
        alert("Report generated successfully!");
        router.push("/dashboard/reports");
      } else {
        const error = await response.json();
        console.error("❌ Report creation failed:", error);
        alert(`Failed to generate report: ${error.message || error.error}`);
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      alert("Error generating report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Report
          </h1>
          <p className="text-gray-600 mt-2">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center space-x-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                step >= num
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {num}
            </div>
            {num < 3 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  step > num ? "bg-indigo-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Upload */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Select Data Source
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
                    {upload.rowCount} records • Period:{" "}
                    {new Date(upload.period).toLocaleDateString("id-ID", {
                      year: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedUpload}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next: Select Fields
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Fields */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Select Fields ({selectedFields.size} selected)
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Select All ({filteredComponents.length})
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex space-x-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="ALL">All Types</option>
              <option value="ALLOWANCE">Allowance</option>
              <option value="DEDUCTION">Deduction</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-gray-500">Loading available fields...</p>
            </div>
          )}

          {/* Fields Grid */}
          {!loading && (
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <div className="divide-y divide-gray-200">
                {filteredComponents.map((comp) => (
                  <label
                    key={comp.id}
                    className="flex items-center space-x-3 p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.has(comp.name)}
                      onChange={() => toggleField(comp.name)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{comp.name}</p>
                      <p className="text-xs text-gray-500">{comp.code}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        comp.type === "ALLOWANCE"
                          ? "bg-green-100 text-green-800"
                          : comp.type === "DEDUCTION"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {comp.type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedFields.size === 0}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next: Configure Report
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure Report */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Configure Report
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
                placeholder="e.g., Monthly Payroll Report October 2025"
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
                placeholder="Add notes or description for this report"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Summary</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  • Data Source:{" "}
                  {uploads.find((u) => u.id === selectedUpload)?.originalName}
                </p>
                <p>• Selected Fields: {selectedFields.size} fields</p>
                <p>• Export Format: Excel (.xlsx)</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={!reportName || generating}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
