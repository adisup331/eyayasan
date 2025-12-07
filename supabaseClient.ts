import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vdbgowimtatttfkhozee.supabase.co';
// Using the key provided in the prompt. 
// Note: Usually this is a JWT string, but we use what is provided.
const supabaseAnonKey = 'sb_publishable_g8-fcRHexioK2BzjbgEBsA_VgWc0JO0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);