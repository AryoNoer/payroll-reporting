// app/(dashboard)/dashboard/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useEffect, useState } from "react";
import { Upload, FileText, Users, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  totalUploads: number;
  totalReports: number;
  totalEmployees: number;
  lastUploadDate: string | null;
  monthlyStats: Array<{ month: string; uploads: number; reports: number }>;
  departmentData: Array<{ name: string; value: number }>;
}

interface DirectorateTrendData {
  data: Array<{ name: string; value: number }>;
  total: number;
}

interface NetSalaryData {
  data: Array<{ employeeNo: string; name: string; salary: number }>;
  stats: {
    average: number;
    min: number;
    max: number;
    total: number;
  };
}

interface GenderData {
  data: Array<{ name: string; value: number; percentage: number }>;
  total: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUploads: 0,
    totalReports: 0,
    totalEmployees: 0,
    lastUploadDate: null,
    monthlyStats: [],
    departmentData: [],
  });
  const [loading, setLoading] = useState(true);

  // Global Filter State
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>(""); // HO or OS
  const [selectedDirectorate, setSelectedDirectorate] = useState<string>("");

  // Chart Data States
  const [directorateData, setDirectorateData] = useState<DirectorateTrendData>({
    data: [],
    total: 0,
  });
  const [directorateLoading, setDirectorateLoading] = useState(true);

  const [netSalaryData, setNetSalaryData] = useState<NetSalaryData>({
    data: [],
    stats: { average: 0, min: 0, max: 0, total: 0 },
  });
  const [netSalaryLoading, setNetSalaryLoading] = useState(true);

  const [genderData, setGenderData] = useState<GenderData>({
    data: [],
    total: 0,
  });
  const [genderLoading, setGenderLoading] = useState(true);

  // Available directorates for filter (populated from data)
  const [availableDirectorates, setAvailableDirectorates] = useState<string[]>(
    []
  );

  // Generate year options (current year and 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const monthOptions = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const typeOptions = [
    { value: "HO", label: "Head Office (HO)" },
    { value: "OS", label: "Operating Site (OS)" },
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    // Fetch all charts when filters change
    fetchDirectorateTrend();
    fetchNetSalaryTrend();
    fetchGenderDistribution();
  }, [selectedYear, selectedMonth, selectedType, selectedDirectorate]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectorateTrend = async () => {
    setDirectorateLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      if (selectedMonth) params.append("month", selectedMonth);
      if (selectedType) params.append("type", selectedType);

      const response = await fetch(
        `/api/dashboard/directorate-trend?${params}`
      );
      const data = await response.json();
      setDirectorateData(data);

      // Populate available directorates for filter
      if (data.data && data.data.length > 0) {
        const directorates = data.data.map((d: any) => d.name).sort();
        setAvailableDirectorates(directorates);
      }
    } catch (error) {
      console.error("Error fetching directorate trend:", error);
    } finally {
      setDirectorateLoading(false);
    }
  };

  const fetchNetSalaryTrend = async () => {
    setNetSalaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      if (selectedMonth) params.append("month", selectedMonth);
      if (selectedType) params.append("type", selectedType);
      if (selectedDirectorate)
        params.append("directorate", selectedDirectorate);

      const response = await fetch(`/api/dashboard/net-salary-trend?${params}`);
      const data = await response.json();
      setNetSalaryData(data);
    } catch (error) {
      console.error("Error fetching net salary trend:", error);
    } finally {
      setNetSalaryLoading(false);
    }
  };

  const fetchGenderDistribution = async () => {
    setGenderLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      if (selectedMonth) params.append("month", selectedMonth);
      if (selectedType) params.append("type", selectedType);
      if (selectedDirectorate)
        params.append("directorate", selectedDirectorate);

      const response = await fetch(
        `/api/dashboard/gender-distribution?${params}`
      );
      const data = await response.json();
      setGenderData(data);
    } catch (error) {
      console.error("Error fetching gender distribution:", error);
    } finally {
      setGenderLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedType("");
    setSelectedDirectorate("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const statCards = [
    {
      title: "Total Uploads",
      value: stats.totalUploads,
      icon: Upload,
      color: "bg-blue-500",
    },
    {
      title: "Total Reports",
      value: stats.totalReports,
      icon: FileText,
      color: "bg-green-500",
    },
    {
      title: "Total Employees",
      value: stats.totalEmployees,
      icon: Users,
      color: "bg-purple-500",
    },
    {
      title: "Growth",
      value: "+12.5%",
      icon: TrendingUp,
      color: "bg-orange-500",
    },
  ];

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Selamat datang di Dinda Reporting System
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : stat.value}
                </p>
              </div>
              <div
                className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Global Filters */}
      <div className="bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            📊 Global Filters
          </h2>
          {(selectedYear ||
            selectedMonth ||
            selectedType ||
            selectedDirectorate) && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent"
            >
              <option value="" className="text-gray-900">
                All Years
              </option>
              {yearOptions.map((year) => (
                <option key={year} value={year} className="text-gray-900">
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent disabled:opacity-50"
              disabled={!selectedYear}
            >
              <option value="" className="text-gray-900">
                All Months
              </option>
              {monthOptions.map((month) => (
                <option
                  key={month.value}
                  value={month.value}
                  className="text-gray-900"
                >
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent"
            >
              <option value="" className="text-gray-900">
                All Types
              </option>
              {typeOptions.map((type) => (
                <option
                  key={type.value}
                  value={type.value}
                  className="text-gray-900"
                >
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Directorate Filter */}
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Directorate
            </label>
            <select
              value={selectedDirectorate}
              onChange={(e) => setSelectedDirectorate(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent"
            >
              <option value="" className="text-gray-900">
                All Directorates
              </option>
              {availableDirectorates.map((dir) => (
                <option key={dir} value={dir} className="text-gray-900">
                  {dir}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedYear ||
          selectedMonth ||
          selectedType ||
          selectedDirectorate) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedYear && (
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                Year: {selectedYear}
              </span>
            )}
            {selectedMonth && (
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                Month:{" "}
                {monthOptions.find((m) => m.value === selectedMonth)?.label}
              </span>
            )}
            {selectedType && (
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                Type: {typeOptions.find((t) => t.value === selectedType)?.label}
              </span>
            )}
            {selectedDirectorate && (
              <span className="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                Directorate: {selectedDirectorate}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Charts Grid - 4 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Employee Distribution by Directorate */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📍 Employee Distribution by Directorate
          </h2>

          {directorateLoading ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : directorateData.data.length === 0 ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-center">
                <p className="text-gray-500 mb-2">No data available</p>
                <p className="text-sm text-gray-400">
                  Try uploading component data or adjust filters
                </p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={directorateData.data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => `${props.name}: ${props.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {directorateData.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-gray-600 text-center">
                Total employees:{" "}
                {directorateData.data.reduce((sum, d) => sum + d.value, 0)}
              </div>
            </>
          )}
        </div>

        {/* 2. Net Salary Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            💰 Net Salary Distribution
          </h2>

          {netSalaryLoading ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : netSalaryData.data.length === 0 ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-center">
                <p className="text-gray-500 mb-2">No salary data available</p>
                <p className="text-sm text-gray-400">
                  Upload component data to view salary trends
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Average</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {formatCurrency(netSalaryData.stats.average)}
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Minimum</p>
                  <p className="text-sm font-semibold text-green-900">
                    {formatCurrency(netSalaryData.stats.min)}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600">Maximum</p>
                  <p className="text-sm font-semibold text-purple-900">
                    {formatCurrency(netSalaryData.stats.max)}
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={netSalaryData.data.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="employeeNo"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={10}
                  />
                  <YAxis
                    tickFormatter={(value) =>
                      `${(value / 1000000).toFixed(0)}M`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) =>
                      `Employee: ${label} - ${
                        netSalaryData.data.find((d) => d.employeeNo === label)
                          ?.name || ""
                      }`
                    }
                  />
                  <Bar dataKey="salary" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-500 text-center mt-2">
                Showing top 20 employees • Total: {netSalaryData.stats.total}{" "}
                employees
              </p>
            </>
          )}
        </div>

        {/* 3. Gender Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            👥 Gender Distribution
          </h2>

          {genderLoading ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : genderData.data.length === 0 ? (
            <div className="flex items-center justify-center h-[350px]">
              <div className="text-center">
                <p className="text-gray-500 mb-2">No gender data available</p>
                <p className="text-sm text-gray-400">
                  Upload component data to view distribution
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-8 mb-6">
                {genderData.data.map((gender) => (
                  <div key={gender.name} className="text-center">
                    <div className="text-6xl mb-2">
                      {gender.name === "Male"
                        ? "👨"
                        : gender.name === "Female"
                        ? "👩"
                        : "❓"}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {gender.value}
                    </p>
                    <p className="text-sm text-gray-600">{gender.name}</p>
                    <p className="text-xs text-gray-500">
                      {gender.percentage.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={genderData.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={(props: any) => `${props.percentage.toFixed(0)}%`}
                  >
                    {genderData.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.name === "Male"
                            ? "#3b82f6"
                            : entry.name === "Female"
                            ? "#ec4899"
                            : "#6b7280"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-sm text-gray-600 text-center mt-2">
                Total: {genderData.total} employees
              </div>
            </>
          )}
        </div>

        {/* 4. Monthly Report (Existing) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Monthly Report
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="uploads"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="reports"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <a
              href="/dashboard/uploads"
              className="flex items-center space-x-3 p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-indigo-900">
                Upload New Data
              </span>
            </a>
            <a
              href="/dashboard/uploads/components"
              className="flex items-center space-x-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">
                Upload Components
              </span>
            </a>
            <a
              href="/dashboard/reports"
              className="flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <FileText className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">
                Generate Report
              </span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="text-sm text-gray-600">
            {stats.lastUploadDate ? (
              <p>
                Last upload: {new Date(stats.lastUploadDate).toLocaleString()}
              </p>
            ) : (
              <p className="text-gray-400">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
