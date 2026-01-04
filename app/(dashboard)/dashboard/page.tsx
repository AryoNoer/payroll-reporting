// app/(dashboard)/dashboard/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface PayrollStats {
  payrollEmployees: number;
  payrollDepartments: number;
  payrollAmount: number;
  maxSalary: number;
  minSalary: number;
}

const COLORS = [
  "#8B0000",
  "#4682B4",
  "#D2B48C",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [selectedYear, setSelectedYear] = useState("(All)");
  const [selectedMonth, setSelectedMonth] = useState("(All)");
  const [selectedDirectorate, setSelectedDirectorate] = useState("(All)");

  // Loading states for progressive rendering
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState({
    dept: true,
    avgSalary: true,
    elements: true,
    jobType: true,
    trend: true,
    age: true,
    los: true,
  });

  // State for all data
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [avgSalaryData, setAvgSalaryData] = useState<any>({
    current: [],
    previous: [],
  });
  const [elementsData, setElementsData] = useState<any>({
    current: [],
    previous: [],
  });
  const [jobTypeData, setJobTypeData] = useState<any[]>([]);
  const [availableDirectorates, setAvailableDirectorates] = useState<string[]>(
    []
  );
  const [trendData, setTrendData] = useState<any[]>([]);
  const [ageData, setAgeData] = useState<any[]>([]);
  const [losData, setLosData] = useState<any[]>([]);

  // Fetch stats first (priority data)
  useEffect(() => {
    fetchStats();
  }, [selectedYear, selectedMonth]);

  // Fetch charts data after stats (progressive loading)
  useEffect(() => {
    fetchChartsData();
  }, [selectedYear, selectedMonth, selectedDirectorate]);

  const fetchStats = async () => {
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (selectedYear !== "(All)") params.append("year", selectedYear);
    if (selectedMonth !== "(All)") params.append("month", selectedMonth);

    try {
      const statsRes = await fetch(`/api/dashboard/payroll-stats?${params}`);
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchChartsData = async () => {
    const params = new URLSearchParams();
    if (selectedYear !== "(All)") params.append("year", selectedYear);
    if (selectedMonth !== "(All)") params.append("month", selectedMonth);

    const jobParams = new URLSearchParams(params);
    if (selectedDirectorate !== "(All)")
      jobParams.append("directorate", selectedDirectorate);

    // Fetch charts one by one for progressive rendering
    // Priority 1: Department & Average Salary (most important)
    fetchDeptData(params);
    fetchAvgSalaryData(params);

    // Priority 2: Elements & Job Type
    setTimeout(() => {
      fetchElementsData(params);
      fetchJobTypeData(jobParams);
    }, 100);

    // Priority 3: Trend, Age, LOS (less critical)
    setTimeout(() => {
      fetchTrendData(params);
      fetchAgeData(params);
      fetchLosData(params);
    }, 200);
  };

  const fetchDeptData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, dept: true }));
    try {
      const res = await fetch(`/api/dashboard/payroll-by-department?${params}`);
      const data = await res.json();
      setDeptData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching dept data:", error);
      setDeptData([]);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, dept: false }));
    }
  };

  const fetchAvgSalaryData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, avgSalary: true }));
    try {
      const res = await fetch(`/api/dashboard/average-net-salary?${params}`);
      const data = await res.json();
      setAvgSalaryData(data || { current: [], previous: [] });
    } catch (error) {
      console.error("Error fetching avg salary:", error);
      setAvgSalaryData({ current: [], previous: [] });
    } finally {
      setLoadingCharts((prev) => ({ ...prev, avgSalary: false }));
    }
  };

  const fetchElementsData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, elements: true }));
    try {
      const res = await fetch(`/api/dashboard/payroll-elements?${params}`);
      const data = await res.json();
      setElementsData(data || { current: [], previous: [] });
    } catch (error) {
      console.error("Error fetching elements:", error);
      setElementsData({ current: [], previous: [] });
    } finally {
      setLoadingCharts((prev) => ({ ...prev, elements: false }));
    }
  };

  const fetchJobTypeData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, jobType: true }));
    try {
      const res = await fetch(`/api/dashboard/payroll-by-job-type?${params}`);
      const data = await res.json();
      setJobTypeData(data.data || []);
      setAvailableDirectorates(data.directorates || []);
    } catch (error) {
      console.error("Error fetching job type:", error);
      setJobTypeData([]);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, jobType: false }));
    }
  };

  const fetchTrendData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, trend: true }));
    try {
      const res = await fetch(`/api/dashboard/net-salary-trend?${params}`);
      const data = await res.json();
      setTrendData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching trend:", error);
      setTrendData([]);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, trend: false }));
    }
  };

  const fetchAgeData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, age: true }));
    try {
      const res = await fetch(`/api/dashboard/employee-age?${params}`);
      const data = await res.json();
      setAgeData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching age:", error);
      setAgeData([]);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, age: false }));
    }
  };

  const fetchLosData = async (params: URLSearchParams) => {
    setLoadingCharts((prev) => ({ ...prev, los: true }));
    try {
      const res = await fetch(`/api/dashboard/length-of-service?${params}`);
      const data = await res.json();
      setLosData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching los:", error);
      setLosData([]);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, los: false }));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(value);
  };

  const ChartSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white text-black p-6 rounded-lg mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
            <span className="text-red-900 font-bold text-2xl">📊</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Analysis Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Progressive Loading Enabled
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div>
            <label className="text-sm block mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white text-gray-900 px-4 py-2 rounded border"
            >
              <option value="(All)">(All)</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>
          <div>
            <label className="text-sm block mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white text-gray-900 px-4 py-2 rounded border"
            >
              <option value="(All)">(All)</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m).padStart(2, "0")}>
                  {new Date(2024, m - 1).toLocaleString("default", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {loadingStats ? (
          <>
            <div className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-700">
              <div className="text-sm text-gray-600 mb-1">
                Payroll Employees:
              </div>
              <div className="text-3xl font-bold text-red-700">
                {formatCurrency(stats?.payrollEmployees || 0)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-600">
              <div className="text-sm text-gray-600 mb-1">
                Current Month (Net salary):
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats?.maxSalary || 0)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-600">
              <div className="text-sm text-gray-600 mb-1">
                Previous Month (Net Salary):
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats?.minSalary || 0)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* First Row: Directorate Pie Chart */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.dept ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">Directorate</h2>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={deptData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    label={false}
                  >
                    {deptData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={60}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Second Row: Average Net Salary - Current Month */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.avgSalary ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Average Net Salary - Current Month
              </h2>
              {avgSalaryData.current.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={avgSalaryData.current}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      angle={-25}
                      textAnchor="end"
                      height={80}
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                    />
                    <Bar dataKey="avgSalary" fill="#8B0000" name="Avg Salary" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-gray-500">
                  No data available for current month
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Third Row: Average Net Salary - Previous Month */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.avgSalary ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Average Net Salary - Previous Month
              </h2>
              {avgSalaryData.previous.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={avgSalaryData.previous}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="department"
                      angle={-25}
                      textAnchor="end"
                      height={80}
                      fontSize={11}
                    />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                    />
                    <Bar dataKey="avgSalary" fill="#D2B48C" name="Avg Salary" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[350px] text-gray-500">
                  {selectedMonth === "(All)"
                    ? "Please select a specific month to view previous month data"
                    : "No data available for previous month"}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fourth Row: Payroll Elements - Current Month */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.elements ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Payroll Elements Details - Current Month (Top 10 Allowances)
              </h2>
              {elementsData.current.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={elementsData.current} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={160}
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="value" fill="#8B0000" name="Allowance Value">
                      {elementsData.current.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill="#8B0000" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  No allowance data available for current month
                </div>
              )}
              {/* Percentage Change Labels */}
              {elementsData.current.length > 0 && (
                <div className="mt-4 space-y-2">
                  {elementsData.current.map(
                    (item: any, index: number) =>
                      item.previousValue > 0 && (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm px-4"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span
                            className={`font-bold ${
                              item.percentageChange > 0
                                ? "text-green-600"
                                : item.percentageChange < 0
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {item.percentageChange > 0
                              ? "↑"
                              : item.percentageChange < 0
                              ? "↓"
                              : "="}{" "}
                            {Math.abs(item.percentageChange)}%
                          </span>
                        </div>
                      )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fifth Row: Payroll Elements - Previous Month */}
      <div className="grid grid-cols-1 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.elements ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Payroll Elements Details - Previous Month (Top 10 Allowances)
              </h2>
              {elementsData.previous.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={elementsData.previous} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={160}
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ fontSize: "12px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="value" fill="#D2B48C" name="Allowance Value">
                      {elementsData.previous.map(
                        (entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill="#D2B48C" />
                        )
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  {selectedMonth === "(All)"
                    ? "Please select a specific month to view previous month data"
                    : "No allowance data available for previous month"}
                </div>
              )}
              {/* Percentage Change Labels */}
              {elementsData.previous.length > 0 && (
                <div className="mt-4 space-y-2">
                  {elementsData.previous.map(
                    (item: any, index: number) =>
                      item.currentValue > 0 && (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm px-4"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span
                            className={`font-bold ${
                              item.percentageChange > 0
                                ? "text-green-600"
                                : item.percentageChange < 0
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {item.percentageChange > 0
                              ? "↑"
                              : item.percentageChange < 0
                              ? "↓"
                              : "="}{" "}
                            {Math.abs(item.percentageChange)}%
                          </span>
                        </div>
                      )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sixth Row: Job Type & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart: Payroll By Job Type (from Grade) */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            {loadingCharts.jobType ? (
              <ChartSkeleton />
            ) : (
              <>
                <h2 className="text-lg font-semibold">
                  Payroll Summary By Job Type (Grade)
                </h2>
                <div>
                  <select
                    value={selectedDirectorate}
                    onChange={(e) => setSelectedDirectorate(e.target.value)}
                    className="bg-white text-gray-900 px-3 py-1.5 rounded border text-sm"
                  >
                    <option value="(All)">All Directorates</option>
                    {availableDirectorates.map((dir) => (
                      <option key={dir} value={dir}>
                        {dir}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jobTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} fontSize={11} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#4682B4" name="Total Payroll" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart: Net Salary Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.trend ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Trend Net Salary Per Month
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="totalSalary"
                    stroke="#8B0000"
                    strokeWidth={2}
                    name="Total Net Salary"
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Sixth Row: Age & Length of Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart: Employee Age Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.age ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Employee Age Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ageRange" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="count" fill="#FF6B6B" name="Employees" />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Chart: Length of Service */}
        <div className="bg-white rounded-lg shadow p-6">
          {loadingCharts.los ? (
            <ChartSkeleton />
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">Length of Service</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={losData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis
                    dataKey="range"
                    type="category"
                    width={100}
                    fontSize={11}
                  />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="count" fill="#4ECDC4" name="Employees" />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
