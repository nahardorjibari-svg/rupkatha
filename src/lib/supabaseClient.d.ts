import type { SupabaseClient } from '@supabase/supabase-js';

export declare const REMEMBER_ME_KEY: string;
export declare function getRememberMePreference(): boolean;
export declare function setRememberMePreference(remember: boolean): void;
export declare const supabase: SupabaseClient<any, 'public', any>;
export default supabase;
