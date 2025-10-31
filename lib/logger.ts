/* eslint-disable @typescript-eslint/no-explicit-any */

// lib/logger.ts
export class AppLogger {
  static log(context: string, message: string, data?: any) {
    console.log(`[${new Date().toISOString()}] [${context}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  static error(context: string, error: any, data?: any) {
    console.error(`[${new Date().toISOString()}] [ERROR] [${context}]`);
    console.error(error);
    if (data) {
      console.error("Additional data:", JSON.stringify(data, null, 2));
    }
  }

  static warn(context: string, message: string, data?: any) {
    console.warn(`[${new Date().toISOString()}] [WARN] [${context}] ${message}`);
    if (data) {
      console.warn(JSON.stringify(data, null, 2));
    }
  }
}