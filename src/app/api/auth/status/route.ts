import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { DEFAULT_SATURATED_FAT_PERCENT } from '@/lib/targets';
import { ensureDemoSeeded } from '@/lib/demo-seed';

/**
 * GET /api/auth/status - Check authentication status and get user settings
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const authenticated = !!userId;
    
    const supabase = createServerClient();
    
    // Check if any users exist (to determine if showing login or signup).
    //
    // "Nobody has signed up" and "the check failed" are different answers, and
    // only the first should open the page on the registration form. A count that
    // came back empty because of a transient error used to read as an empty
    // database, dropping a visitor to a site full of accounts into Create Account.
    const { data: anyUser, error: usersError } = await supabase
      .from('user_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const isSetUp = usersError ? true : !!anyUser;

    // Get current user's settings if authenticated
    let settings = null;
    if (authenticated && userId) {
      const readSettings = async () => {
        const { data } = await supabase
          .from('user_settings')
          .select('*')
          .eq('id', userId)
          .single();
        return data;
      };

      let data = await readSettings();

      if (data) {
        // The shared demo account tops itself up here rather than on a cron: this
        // runs on every page load, so the history is complete by the time anything
        // reads it, and it stays correct however long the account sat unused.
        const demoSeeded = await ensureDemoSeeded(supabase, {
          id: data.id,
          email: data.email,
          timezone: data.timezone,
        });

        // Seeding a new day moves the demo account's weight, which drives BMR and
        // the protein target on the dashboard below.
        if (demoSeeded) data = (await readSettings()) ?? data;

        settings = {
          name: data.name,
          weight_kg: data.weight_kg,
          height_cm: data.height_cm,
          age_years: data.age_years,
          sex: data.sex,
          calorie_deficit: data.calorie_deficit,
          saturated_fat_percent: data.saturated_fat_percent ?? DEFAULT_SATURATED_FAT_PERCENT,
          protein_g_per_kg: data.protein_g_per_kg ?? 1.8,
          protein_floor_g: data.protein_floor_g ?? 150,
          supplements: data.supplements ?? [],
          timezone: data.timezone,
        };
      }
    }

    return NextResponse.json({
      authenticated,
      isSetUp,
      settings,
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json({ 
      authenticated: false, 
      // Same reasoning as above: on an unknown failure show the sign-in form,
      // rather than inviting someone who has an account to make a second one.
      isSetUp: true,
      settings: null,
    });
  }
}
