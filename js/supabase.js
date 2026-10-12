import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// URL project Supabase
const SUPABASE_URL = "https://stqxolrxzyvebldkslmz.supabase.co";

// Publishable key dari Supabase Dashboard
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wNZIp0RmhrPVdlrFDICOkg_ssG7C1W8";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);