"use client";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  Zap,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <main className="max-w-6xl w-full">
          {/* Hero Section */}
          <div className="text-center space-y-8 mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-indigo-200 shadow-sm">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">
                Dinda Management System
              </span>
            </div>

            {/* Main Heading */}
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
                {/* <Package className="w-8 h-8 text-white" /> */}
                <Image src="/folder.png" alt="Logo" width={64} height={64} />
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                Halo !
                <span className="block bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Selamat datang di Dinda Reporting System
                </span>
              </h1>
              {/* <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Platform modern untuk mengelola data report, generate reports,
                dan analisis kompensasi karyawan dengan mudah.
              </p> */}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                Login ke Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="group relative bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 hover:border-indigo-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload & Process
              </h3>
              <p className="text-sm text-gray-600">
                Upload CSV files dan proses data report secara otomatis dengan
                progress tracking real-time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 hover:border-purple-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generate Reports
              </h3>
              <p className="text-sm text-gray-600">
                Buat custom reports dengan field selection yang fleksibel dan
                export ke Excel format.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 hover:border-pink-300 hover:-translate-y-1">
              <div className="w-12 h-12 bg-linear-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Smart Analytics
              </h3>
              <p className="text-sm text-gray-600">
                Analisis data kompensasi dengan field calculations otomatis dan
                insight mendalam.
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-16 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span>Secure & Reliable</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Real-time Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <span>Fast Performance</span>
            </div>
          </div>
        </main>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
