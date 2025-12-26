// app/(dashboard)/dashboard/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/(dashboard)/dashboard/page.tsx
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
  Treemap,
} from "recharts";

interface PayrollStats {
  payrollEmployees: number;
  payrollDepartments: number;
  payrollAmount: number;
  maxSalary: number;
  minSalary: number;
}

const COLORS = ["#8B0000", "#4682B4", "#D2B48C"];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState("(All)");
  const [selectedMonth, setSelectedMonth] = useState("(All)");

  // State for all data
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [salaryRangeData, setSalaryRangeData] = useState<any>({
    data: [],
    ranges: [],
  });
  const [elementsData, setElementsData] = useState<any[]>([]);
  const [jobTypeData, setJobTypeData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any>({
    data: [],
    departments: [],
  });
  const [gradeData, setGradeData] = useState<any[]>([]);

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
        rangeRes,
        elemRes,
        jobRes,
        monthlyRes,
        gradeRes,
      ] = await Promise.all([
        fetch(`/api/dashboard/payroll-stats?${params}`),
        fetch(`/api/dashboard/payroll-by-department?${params}`),
        fetch(`/api/dashboard/employees-by-salary-range?${params}`),
        fetch(`/api/dashboard/payroll-elements?${params}`),
        fetch(`/api/dashboard/payroll-by-job-type?${params}`),
        fetch(
          `/api/dashboard/monthly-payroll-by-dept?year=${
            selectedYear !== "(All)" ? selectedYear : ""
          }`
        ),
        fetch(`/api/dashboard/payroll-by-grade?${params}`),
      ]);

      // ✅ Helper function untuk parse JSON dengan fallback
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
      setSalaryRangeData(await parseJson(rangeRes, { data: [], ranges: [] }));
      setElementsData(await parseJson(elemRes, []));
      setJobTypeData(await parseJson(jobRes, []));
      setMonthlyData(
        await parseJson(monthlyRes, { data: [], departments: [] })
      );
      setGradeData(await parseJson(gradeRes, []));
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

        {/* Chart 2: Employees By Salary Range */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Average Net Salary</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={salaryRangeData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="department"
                angle={-25}
                textAnchor="end"
                height={80}
                fontSize={11}
              />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ fontSize: "12px" }} />
              {/* <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} /> */}
              {salaryRangeData.ranges.map((range: any, idx: number) => (
                <Bar
                  key={range.key}
                  dataKey={range.key}
                  stackId="a"
                  fill={COLORS[idx]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Payroll Elements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Payroll Elements Details
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={elementsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" width={140} fontSize={11} />
              <Tooltip
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="value" fill="#8B0000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second Row: 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Chart 4: Payroll By Job Type */}
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
              <Bar dataKey="value" fill="#D2B48C" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Chart 5: Monthly Average Payroll */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Monthly Average Payroll By department
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {monthlyData.departments.map((dept: string, idx: number) => (
                <Bar
                  key={dept}
                  dataKey={dept}
                  stackId="a"
                  fill={COLORS[idx % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Chart 6: Payroll By Grade */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Payroll Summary By Grade
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="value" fill="#8B0000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
