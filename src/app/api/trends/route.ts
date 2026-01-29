import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from '@/lib/auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');

  const supabase = getSupabase();

  // Get user settings for TDEE calculation
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .single();

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get daily totals for the date range (only days with entries)
  const { data: entries } = await supabase
    .from('entries')
    .select(`
      resolved_date,
      entry_items (
        calories,
        protein_g,
        carbs_g,
        fat_g,
        saturated_fat_g,
        fiber_g,
        added_sugar_g,
        sodium_mg
      )
    `)
    .eq('user_id', userId)
    .gte('resolved_date', startDateStr)
    .lte('resolved_date', endDateStr)
    .order('resolved_date', { ascending: true });

  // Get activity levels for each day
  const { data: activities } = await supabase
    .from('daily_activity')
    .select('resolved_date, activity_level_id')
    .eq('user_id', userId)
    .gte('resolved_date', startDateStr)
    .lte('resolved_date', endDateStr);

  // Build activity lookup
  const activityMap: Record<string, number> = {};
  activities?.forEach((a) => {
    activityMap[a.resolved_date] = a.activity_level_id;
  });

  // Activity multipliers
  const multipliers = [1.2, 1.375, 1.55, 1.725, 1.9];

  // Calculate BMR if we have settings
  let bmr: number | null = null;
  if (settings?.weight_kg && settings?.height_cm && settings?.age_years && settings?.sex) {
    if (settings.sex === 'male') {
      bmr = 10 * settings.weight_kg + 6.25 * settings.height_cm - 5 * settings.age_years + 5;
    } else {
      bmr = 10 * settings.weight_kg + 6.25 * settings.height_cm - 5 * settings.age_years - 161;
    }
  }

  // Aggregate by date
  const dailyData: Record<string, {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    saturatedFat: number;
    fiber: number;
    addedSugar: number;
    sodium: number;
    tdee: number | null;
    targetCalories: number | null;
    targetProtein: number | null;
  }> = {};

  entries?.forEach((entry) => {
    const date = entry.resolved_date;
    if (!dailyData[date]) {
      // Calculate TDEE for this day
      const activityLevel = activityMap[date] || 3; // Default to moderate
      const multiplier = multipliers[activityLevel - 1];
      const tdee = bmr ? Math.round(bmr * multiplier) : null;
      const targetCalories = tdee && settings?.calorie_deficit 
        ? tdee - settings.calorie_deficit 
        : null;
      const targetProtein = settings?.weight_kg 
        ? Math.round(settings.weight_kg * 1.6) 
        : null;

      dailyData[date] = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        addedSugar: 0,
        sodium: 0,
        tdee,
        targetCalories,
        targetProtein,
      };
    }

    entry.entry_items?.forEach((item: Record<string, number>) => {
      dailyData[date].calories += item.calories || 0;
      dailyData[date].protein += item.protein_g || 0;
      dailyData[date].carbs += item.carbs_g || 0;
      dailyData[date].fat += item.fat_g || 0;
      dailyData[date].saturatedFat += item.saturated_fat_g || 0;
      dailyData[date].fiber += item.fiber_g || 0;
      dailyData[date].addedSugar += item.added_sugar_g || 0;
      dailyData[date].sodium += item.sodium_mg || 0;
    });
  });

  // Convert to array and sort
  const chartData = Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      ...data,
      deficit: data.tdee ? data.tdee - data.calories : null,
      proteinPercent: data.targetProtein 
        ? Math.round((data.protein / data.targetProtein) * 100) 
        : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate averages for last 7 and 30 days
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last7Days = chartData.filter(d => new Date(d.date) >= sevenDaysAgo);
  const last30Days = chartData.filter(d => new Date(d.date) >= thirtyDaysAgo);

  const calculateAverages = (data: typeof chartData) => {
    if (data.length === 0) return null;
    
    const withDeficit = data.filter(d => d.deficit !== null);
    const withProtein = data.filter(d => d.proteinPercent !== null);

    return {
      avgCalories: Math.round(data.reduce((sum, d) => sum + d.calories, 0) / data.length),
      avgProtein: Math.round(data.reduce((sum, d) => sum + d.protein, 0) / data.length),
      avgDeficit: withDeficit.length > 0 
        ? Math.round(withDeficit.reduce((sum, d) => sum + (d.deficit || 0), 0) / withDeficit.length)
        : null,
      avgProteinPercent: withProtein.length > 0
        ? Math.round(withProtein.reduce((sum, d) => sum + (d.proteinPercent || 0), 0) / withProtein.length)
        : null,
      avgSaturatedFat: Math.round(data.reduce((sum, d) => sum + d.saturatedFat, 0) / data.length),
      avgAddedSugar: Math.round(data.reduce((sum, d) => sum + d.addedSugar, 0) / data.length),
      avgSodium: Math.round(data.reduce((sum, d) => sum + d.sodium, 0) / data.length),
      avgFiber: Math.round(data.reduce((sum, d) => sum + d.fiber, 0) / data.length),
      daysTracked: data.length,
    };
  };

  // Get recommendations for comparison
  const isMale = settings?.sex === 'male';
  const targetCalories = bmr && settings?.calorie_deficit
    ? Math.round(bmr * 1.55 - settings.calorie_deficit) // Use moderate activity for baseline
    : 2000;

  const recommendations = {
    saturatedFatLimit: Math.round((targetCalories * 0.10) / 9),
    addedSugarLimit: isMale ? 36 : 25,
    sodiumLimit: 2300,
    fiberTarget: isMale ? 38 : 25,
  };

  return NextResponse.json({
    chartData,
    averages: {
      week: calculateAverages(last7Days),
      month: calculateAverages(last30Days),
    },
    recommendations,
    settings: settings ? {
      targetProtein: settings.weight_kg ? Math.round(settings.weight_kg * 1.6) : null,
      calorieDeficit: settings.calorie_deficit,
    } : null,
  });
}
