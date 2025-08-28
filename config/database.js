// Compatibility stub for legacy Supabase-dependent files
// This prevents crashes while transitioning to MongoDB-only architecture

// Legacy Supabase database config loaded. This file exists only for compatibility.
// All database operations should use MongoDB via models/index.js

// Stub Supabase client to prevent crashes
const supabase = {
  from: (table) => ({
    select: () => ({
      eq: () => ({
        order: () => ({ data: null, error: 'Supabase disabled - use MongoDB' }),
        single: () => ({ data: null, error: 'Supabase disabled - use MongoDB' }),
        range: () => ({ data: null, error: 'Supabase disabled - use MongoDB' })
      }),
      single: () => ({ data: null, error: 'Supabase disabled - use MongoDB' })
    }),
    insert: () => ({
      select: () => ({
        single: () => ({ data: null, error: 'Supabase disabled - use MongoDB' })
      })
    }),
    update: () => ({
      eq: () => ({ data: null, error: 'Supabase disabled - use MongoDB' })
    }),
    delete: () => ({
      eq: () => ({ data: null, error: 'Supabase disabled - use MongoDB' })
    })
  }),
  rpc: () => ({ data: null, error: 'Supabase disabled - use MongoDB' }),
  auth: {
    signUp: () => ({ data: null, error: 'Auth disabled - use MongoDB' }),
    signInWithPassword: () => ({ data: null, error: 'Auth disabled - use MongoDB' }),
    signOut: () => ({ data: null, error: 'Auth disabled - use MongoDB' })
  }
};

module.exports = {
  supabase
};