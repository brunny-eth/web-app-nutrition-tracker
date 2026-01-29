import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/auth/status - Check authentication status and setup state
 */
export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    
    const supabase = createServerClient();
    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)
      .single();

    const isSetUp = !!settings;

    return NextResponse.json({
      authenticated,
      isSetUp,
      settings: authenticated && settings ? {
        name: settings.name,
        weight_kg: settings.weight_kg,
        height_cm: settings.height_cm,
        age_years: settings.age_years,
        sex: settings.sex,
        calorie_deficit: settings.calorie_deficit,
        timezone: settings.timezone,
      } : null,
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
