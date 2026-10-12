import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Gunakan URL dan publishable key milik project Supabase lu.
const SUPABASE_URL = "https://stqxolrxzyvebldkslmz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "TEMPEL_PUBLISHABLE_KEY_LU_DI_SINI";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
