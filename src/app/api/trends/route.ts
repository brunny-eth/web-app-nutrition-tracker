import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from '@/lib/auth';
import { supplementFiberBonus } from '@/lib/supplements';
import { FALLBACK_ACTIVITY_MULTIPLIER, resolveActivityMultiplier } from '@/lib/tdee';
import { roundLbs } from '@/lib/units';
import { DEFAULT_SATURATED_FAT_PERCENT, saturatedFatPercentOfCalories } from '@/lib/targets';

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
        calories_low,
        calories_high,
        protein_g,
        carbs_g,
        fat_g,
        saturated_fat_g,
        fiber_g,
        added_sugar_g,
        sodium_mg,
        potassium_mg
      )
    `)
    .eq('user_id', userId)
    .gte('resolved_date', startDateStr)
    .lte('resolved_date', endDateStr)
    .order('resolved_date', { ascending: true });

  // Get activity levels for each day. `multiplier` is the newer continuous estimate;
  // `activity_level_id` is the legacy 5-way level and is null whenever the former is set.
  const { data: activities } = await supabase
    .from('daily_activity')
    .select('resolved_date, activity_level_id, multiplier')
    .eq('user_id', userId)
    .gte('resolved_date', startDateStr)
    .lte('resolved_date', endDateStr);

  // Get supplement/alcohol checklist for each day
  const { data: checklists } = await supabase
    .from('daily_checklist')
    .select('resolved_date, supplements_taken, alcohol, bp_systolic, bp_diastolic')
    .eq('user_id', userId)
    .gte('resolved_date', startDateStr)
    .lte('resolved_date', endDateStr);

  // Blood pressure lookup (sparse — only days the user logged a reading)
  const bpMap: Record<string, { sys: number | null; dia: number | null }> = {};
  checklists?.forEach((c) => {
    if (c.bp_systolic != null || c.bp_diastolic != null) {
      bpMap[c.resolved_date] = { sys: c.bp_systolic ?? null, dia: c.bp_diastolic ?? null };
    }
  });

  // Weight series. Deliberately ignores both the selected day range and the
  // exclude-today rule: a months-long view is the whole point of a weight trend,
  // it's one number per day so full history is cheap, and a morning weigh-in is
  // complete the moment it's entered (unlike an accumulating calorie total).
  const { data: weightRows } = await supabase
    .from('daily_checklist')
    .select('resolved_date, weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('resolved_date', { ascending: true });

  const weightData = (weightRows ?? []).map((w) => ({
    date: w.resolved_date,
    weightLbs: roundLbs(Number(w.weight_kg)),
  }));

  // Supplements taken per day, for folding psyllium's fiber into daily totals.
  const supplementsTakenByDate: Record<string, string[]> = {};
  checklists?.forEach((c) => {
    supplementsTakenByDate[c.resolved_date] = c.supplements_taken ?? [];
  });

  // Build activity lookup, keyed by resolved multiplier so both row shapes are honored.
  const multiplierByDate: Record<string, number> = {};
  activities?.forEach((a) => {
    multiplierByDate[a.resolved_date] = resolveActivityMultiplier(a);
  });

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
    // Estimation range from parsing each food item, summed across the day.
    caloriesLow: number;
    caloriesHigh: number;
    protein: number;
    carbs: number;
    fat: number;
    saturatedFat: number;
    fiber: number;
    addedSugar: number;
    sodium: number;
    potassium: number;
    tdee: number | null;
    targetCalories: number | null;
    targetProtein: number | null;
  }> = {};

  entries?.forEach((entry) => {
    const date = entry.resolved_date;
    if (!dailyData[date]) {
      // Calculate TDEE for this day
      const multiplier = multiplierByDate[date] ?? FALLBACK_ACTIVITY_MULTIPLIER;
      const tdee = bmr ? Math.round(bmr * multiplier) : null;
      const targetCalories = tdee && settings?.calorie_deficit 
        ? tdee - settings.calorie_deficit 
        : null;
      const targetProtein = settings?.weight_kg
        ? Math.max(
            Math.round(settings.weight_kg * (settings.protein_g_per_kg ?? 1.8)),
            settings.protein_floor_g ?? 150
          )
        : null;

      dailyData[date] = {
        calories: 0,
        caloriesLow: 0,
        caloriesHigh: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        saturatedFat: 0,
        fiber: 0,
        addedSugar: 0,
        sodium: 0,
        potassium: 0,
        tdee,
        targetCalories,
        targetProtein,
      };
    }

    entry.entry_items?.forEach((item: Record<string, number>) => {
      dailyData[date].calories += item.calories || 0;
      // Fall back to the point estimate so a day with older rows still spans a range.
      dailyData[date].caloriesLow += item.calories_low ?? item.calories ?? 0;
      dailyData[date].caloriesHigh += item.calories_high ?? item.calories ?? 0;
      dailyData[date].protein += item.protein_g || 0;
      dailyData[date].carbs += item.carbs_g || 0;
      dailyData[date].fat += item.fat_g || 0;
      dailyData[date].saturatedFat += item.saturated_fat_g || 0;
      dailyData[date].fiber += item.fiber_g || 0;
      dailyData[date].addedSugar += item.added_sugar_g || 0;
      dailyData[date].sodium += item.sodium_mg || 0;
      dailyData[date].potassium += item.potassium_mg || 0;
    });
  });

  // Fold psyllium's fiber into each day's total, matching the daily view.
  // Only days with logged food appear here; a psyllium-only day with no food
  // logged won't show in trends, which is an acceptable edge case.
  Object.keys(dailyData).forEach((date) => {
    dailyData[date].fiber += supplementFiberBonus(
      settings?.supplements,
      supplementsTakenByDate[date]
    );
  });

  // Convert to array and sort
  const allChartData = Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      ...data,
      deficit: data.tdee ? data.tdee - data.calories : null,
      proteinPercent: data.targetProtein 
        ? Math.round((data.protein / data.targetProtein) * 100) 
        : null,
      kNaRatio: data.sodium > 0 && data.potassium > 0
        ? data.potassium / data.sodium
        : null,
      // Share of the day's consumed calories from saturated fat. Charted instead of
      // grams so the limit is a flat line rather than one that steps with activity.
      satFatPercent: saturatedFatPercentOfCalories(data.saturatedFat, data.calories),
      bpSystolic: bpMap[date]?.sys ?? null,
      bpDiastolic: bpMap[date]?.dia ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Exclude today so charts and averages only use complete days (today is still in progress)
  const todayStr = endDateStr;
  const chartData = allChartData.filter((d) => d.date !== todayStr);

  // Calculate averages for last 7 and 30 days (already excludes today via chartData)
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last7Days = chartData.filter((d) => new Date(d.date) >= sevenDaysAgo);
  const last30Days = chartData.filter((d) => new Date(d.date) >= thirtyDaysAgo);

  const calculateAverages = (data: typeof chartData) => {
    if (data.length === 0) return null;
    
    const withDeficit = data.filter(d => d.deficit !== null);
    const withProtein = data.filter(d => d.proteinPercent !== null);
    const withKNaRatio = data.filter(d => d.kNaRatio !== null);

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
      // Aggregate ratio, not a mean of daily ratios — a 1200 kcal day shouldn't weigh
      // as heavily as a 3000 kcal one when describing overall diet composition.
      avgSatFatPercent: (() => {
        const totalCalories = data.reduce((sum, d) => sum + d.calories, 0);
        const pct = saturatedFatPercentOfCalories(
          data.reduce((sum, d) => sum + d.saturatedFat, 0),
          totalCalories
        );
        return pct === null ? null : Math.round(pct * 10) / 10;
      })(),
      avgAddedSugar: Math.round(data.reduce((sum, d) => sum + d.addedSugar, 0) / data.length),
      avgSodium: Math.round(data.reduce((sum, d) => sum + d.sodium, 0) / data.length),
      avgPotassium: Math.round(data.reduce((sum, d) => sum + d.potassium, 0) / data.length),
      avgKNaRatio: withKNaRatio.length > 0
        ? withKNaRatio.reduce((sum, d) => sum + (d.kNaRatio || 0), 0) / withKNaRatio.length
        : null,
      avgFiber: Math.round(data.reduce((sum, d) => sum + d.fiber, 0) / data.length),
      daysTracked: data.length,
    };
  };

  // Get recommendations for comparison
  const isMale = settings?.sex === 'male';

  const recommendations = {
    // A percentage rather than a gram cap: grams would have to be derived from a
    // single assumed activity level for the whole period, which contradicted the
    // dashboard's per-day budget.
    saturatedFatPercent: settings?.saturated_fat_percent ?? DEFAULT_SATURATED_FAT_PERCENT,
    addedSugarLimit: isMale ? 36 : 25,
    sodiumLimit: 2300,
    fiberTarget: isMale ? 38 : 25,
  };

  // --- Supplement & alcohol adherence ---
  // Denominator is days that have a checklist row (so pre-feature days don't count against you).
  const supplementsList: { id: string; name: string }[] = Array.isArray(settings?.supplements)
    ? settings.supplements
    : [];

  const todayStrForChecklist = endDateStr;
  const checklistRows = (checklists ?? []).filter((c) => c.resolved_date !== todayStrForChecklist);

  const computeAdherence = (windowStart: Date) => {
    const rows = checklistRows.filter((c) => new Date(c.resolved_date) >= windowStart);
    if (rows.length === 0) return null;

    const supplements = supplementsList.map((s) => {
      const taken = rows.filter((r) => (r.supplements_taken ?? []).includes(s.id)).length;
      return {
        id: s.id,
        name: s.name,
        taken,
        pct: Math.round((taken / rows.length) * 100),
      };
    });

    const alcoholFreeDays = rows.filter((r) => !r.alcohol).length;

    return {
      days: rows.length,
      supplements,
      alcoholFreeDays,
      alcoholFreePct: Math.round((alcoholFreeDays / rows.length) * 100),
    };
  };

  return NextResponse.json({
    chartData,
    weightData,
    averages: {
      week: calculateAverages(last7Days),
      month: calculateAverages(last30Days),
    },
    adherence: {
      week: computeAdherence(sevenDaysAgo),
      month: computeAdherence(thirtyDaysAgo),
    },
    recommendations,
    settings: settings ? {
      targetProtein: settings.weight_kg
        ? Math.max(
            Math.round(settings.weight_kg * (settings.protein_g_per_kg ?? 1.8)),
            settings.protein_floor_g ?? 150
          )
        : null,
      calorieDeficit: settings.calorie_deficit,
    } : null,
  });
}
