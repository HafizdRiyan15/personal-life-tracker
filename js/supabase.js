import { createClient } from "https://stqxolrxzyvebldkslmz.supabase.co";

// Gunakan URL dan publishable key milik project Supabase lu.
const SUPABASE_URL = "sb_publishable_wNZIp0RmhrPVdlrFDICOkg_ssG7C1W8";
const SUPABASE_PUBLISHABLE_KEY = "TEMPEL_PUBLISHABLE_KEY_LU_DI_SINI";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
