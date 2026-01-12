// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Validasi environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables (URL or ANON_KEY)')
}

// Browser client (untuk components) - uses anon key
export const createBrowserClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
    },
  })
}

// Server-side client (untuk API routes) - uses anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})

// Admin client (untuk backend operations) - uses service_role key
// This client BYPASSES Row Level Security (RLS)
export const createAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - required for admin operations')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Export admin client instance for direct use
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Helper functions untuk Storage
export const storageHelpers = {
  /**
   * Upload file ke Supabase Storage (Browser)
   * @param bucket - Nama bucket (e.g., 'payroll-components')
   * @param file - File object dari browser
   * @param path - Path dalam bucket (optional, default: timestamp-filename)
   */
  async uploadFile(
    bucket: string,
    file: File,
    path?: string
  ): Promise<{ url: string; path: string; error?: string }> {
    const client = createBrowserClient()
    
    // Generate unique filename jika path tidak disediakan
    const fileName = path || `${Date.now()}-${file.name}`
    
    // Upload file
    const { data, error } = await client.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return { url: '', path: '', error: error.message }
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
    }
  },

  /**
   * Upload file ke Supabase Storage (Backend/Admin)
   * @param bucket - Nama bucket
   * @param fileBuffer - Buffer dari file
   * @param path - Path dalam bucket
   * @param contentType - MIME type (default: text/csv)
   */
  async uploadFileAdmin(
    bucket: string,
    fileBuffer: ArrayBuffer,
    path: string,
    contentType: string = 'text/csv'
  ): Promise<{ url: string; path: string; error?: string }> {
    if (!supabaseAdmin) {
      return { 
        url: '', 
        path: '', 
        error: 'Admin client not configured - missing SUPABASE_SERVICE_ROLE_KEY' 
      }
    }
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Admin upload error:', error)
      return { url: '', path: '', error: error.message }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
    }
  },

  /**
   * Get signed URL untuk private bucket
   * @param bucket - Nama bucket
   * @param path - Path file di bucket
   * @param expiresIn - Waktu expire dalam detik (default: 3600 = 1 jam)
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; error?: string }> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Signed URL error:', error)
      return { url: '', error: error.message }
    }

    return { url: data.signedUrl }
  },

  /**
   * Download file dari Storage (Admin)
   * @param bucket - Nama bucket
   * @param path - Path file di bucket
   */
  async downloadFileAdmin(
    bucket: string,
    path: string
  ): Promise<{ data: Blob | null; error?: string }> {
    if (!supabaseAdmin) {
      return { 
        data: null, 
        error: 'Admin client not configured - missing SUPABASE_SERVICE_ROLE_KEY' 
      }
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path)

    if (error) {
      console.error('Download error:', error)
      return { data: null, error: error.message }
    }

    return { data }
  },

  /**
   * Delete file dari Storage (Admin)
   * @param bucket - Nama bucket
   * @param paths - Array of file paths to delete
   */
  async deleteFilesAdmin(
    bucket: string,
    paths: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabaseAdmin) {
      return { 
        success: false, 
        error: 'Admin client not configured - missing SUPABASE_SERVICE_ROLE_KEY' 
      }
    }

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove(paths)

    if (error) {
      console.error('Delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  },
}

// Storage constants
export const STORAGE_BUCKETS = {
  PAYROLL_COMPONENTS: 'payroll-components',
  PAYROLL_UPLOADS: 'PAYROLL-UPLOADS',
} as const

// Max file size (500MB - sesuai Supabase bucket limit)
export const MAX_FILE_SIZE = 524288000 // 500MB in bytes