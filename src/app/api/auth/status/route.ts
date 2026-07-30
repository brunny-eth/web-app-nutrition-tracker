import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { DEFAULT_SATURATED_FAT_PERCENT } from '@/lib/targets';

/**
 * GET /api/auth/status - Check authentication status and get user settings
 */
export async function GET() {
  try {
    const userId = await getUserId();
    const authenticated = !!userId;
    
    const supabase = createServerClient();
    
    // Check if any users exist (to determine if showing login or signup)
    const { count } = await supabase
      .from('user_settings')
      .select('*', { count: 'exact', head: true });

    const isSetUp = (count || 0) > 0;

    // Get current user's settings if authenticated
    let settings = null;
    if (authenticated && userId) {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
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
      isSetUp: false,
      settings: null,
    });
  }
}
