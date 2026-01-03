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
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState("(All)");
  const [selectedMonth, setSelectedMonth] = useState("(All)");

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
  const [trendData, setTrendData] = useState<any[]>([]);
  const [ageData, setAgeData] = useState<any[]>([]);
  const [losData, setLosData] = useState<any[]>([]);

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, [selectedYear, selectedMonth]);

  const fetchAllData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedYear !== "(All)") params.append("year", selectedYear);
    if (selectedMonth !== "(All)") params.append("month", selectedMonth);

    try {
      const [
        statsRes,
        deptRes,
        avgSalaryRes,
        elemRes,
        jobRes,
        trendRes,
        ageRes,
        losRes,
      ] = await Promise.all([
        fetch(`/api/dashboard/payroll-stats?${params}`),
        fetch(`/api/dashboard/payroll-by-department?${params}`),
        fetch(`/api/dashboard/average-net-salary?${params}`),
        fetch(`/api/dashboard/payroll-elements?${params}`),
        fetch(`/api/dashboard/payroll-by-job-type?${params}`),
        fetch(`/api/dashboard/net-salary-trend?${params}`),
        fetch(`/api/dashboard/employee-age?${params}`),
        fetch(`/api/dashboard/length-of-service?${params}`),
      ]);

      const parseJson = async (res: Response, fallback: any) => {
        try {
          if (!res.ok) {
            console.error(`API Error ${res.status}:`, res.url);
            return fallback;
          }
          const text = await res.text();
          if (!text) {
            console.warn("Empty response from:", res.url);
            return fallback;
          }
          return JSON.parse(text);
        } catch (err) {
          console.error("JSON parse error:", err, "URL:", res.url);
          return fallback;
        }
      };

      setStats(await parseJson(statsRes, null));
      setDeptData(await parseJson(deptRes, []));
      setAvgSalaryData(
        await parseJson(avgSalaryRes, { current: [], previous: [] })
      );
      setElementsData(await parseJson(elemRes, { current: [], previous: [] }));
      setJobTypeData(await parseJson(jobRes, []));
      setTrendData(await parseJson(trendRes, []));
      setAgeData(await parseJson(ageRes, []));
      setLosData(await parseJson(losRes, []));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

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
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-700">
          <div className="text-sm text-gray-600 mb-1">Payroll Employees:</div>
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
      </div>

      {/* First Row: 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Chart 1: Payroll By Departments */}
        <div className="bg-white rounded-lg shadow p-6">
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
        </div>

        {/* Chart 2: Average Net Salary - Current vs Previous */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Average Net Salary</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={[
                ...avgSalaryData.current.map((item: any) => ({
                  ...item,
                  period: "Current",
                })),
                ...avgSalaryData.previous.map((item: any) => ({
                  ...item,
                  period: "Previous",
                })),
              ]}
            >
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
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
              <Bar dataKey="avgSalary" fill="#8B0000" name="Avg Salary" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Payroll Elements - Top 10 Allowance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Payroll Elements Details (Top 10)
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={elementsData.current} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" width={140} fontSize={11} />
              <Tooltip
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="value" fill="#8B0000" name="Current" />
              <Bar dataKey="previousValue" fill="#D2B48C" name="Previous" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second Row: Job Type & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 4: Payroll By Job Type (from Grade) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Payroll Summary By Job Type
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={jobTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={140} fontSize={11} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#4682B4" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 5: Net Salary Trend (Line Chart) */}
        <div className="bg-white rounded-lg shadow p-6">
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
        </div>
      </div>

      {/* Third Row: Age & Length of Service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Chart 6: Employee Age Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
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
        </div>

        {/* Chart 7: Length of Service */}
        <div className="bg-white rounded-lg shadow p-6">
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
        </div>
      </div>
    </div>
  );
}
