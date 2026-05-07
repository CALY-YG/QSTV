import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vftzwtgyrjefwijfhmgn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmdHp3dGd5cmplZndpamZobWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDAwNzgsImV4cCI6MjA5MzcxNjA3OH0.ZBca3en5HGFX8AjCKqrzTQMJ_y_0bfUOw-u0j4cGKUs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
