// app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Upload, FileText, Users, TrendingUp } from "lucide-react";

interface DashboardStats {
  totalUploads: number;
  totalReports: number;
  totalEmployees: number;
  lastUploadDate: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUploads: 0,
    totalReports: 0,
    totalEmployees: 0,
    lastUploadDate: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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
