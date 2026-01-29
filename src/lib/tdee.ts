import type { TDEECalculation, ActivityLevelOption } from '@/types/nutrition';
import type { UserSettings } from '@/types/database';

/**
 * TDEE Calculator using Mifflin-St Jeor equation
 * 
 * BMR for men: (10 × weight in kg) + (6.25 × height in cm) − (5 × age in years) + 5
 * BMR for women: (10 × weight in kg) + (6.25 × height in cm) − (5 × age in years) − 161
 * 
 * TDEE = BMR × Activity Multiplier
 * 
 * BMR uncertainty: ±10% (individual variation in metabolism)
 */

const BMR_UNCERTAINTY = 0.10; // 10% uncertainty on BMR

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: 'male' | 'female'
): { bmr: number; bmr_low: number; bmr_high: number } {
  let bmr: number;
  
  if (sex === 'male') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) - 161;
  }

  return {
    bmr: Math.round(bmr),
    bmr_low: Math.round(bmr * (1 - BMR_UNCERTAINTY)),
    bmr_high: Math.round(bmr * (1 + BMR_UNCERTAINTY)),
  };
}

/**
 * Calculate TDEE from BMR and activity level
 */
export function calculateTDEE(
  bmr: number,
  bmrLow: number,
  bmrHigh: number,
  activityMultiplier: number,
  activityMultiplierLow: number,
  activityMultiplierHigh: number,
  calorieDeficit: number
): TDEECalculation & { protein_target_g: number } {
  const tdee = Math.round(bmr * activityMultiplier);
  const tdeeLow = Math.round(bmrLow * activityMultiplierLow);
  const tdeeHigh = Math.round(bmrHigh * activityMultiplierHigh);

  const targetCalories = Math.round(tdee - calorieDeficit);
  const targetCaloriesLow = Math.round(tdeeLow - calorieDeficit);
  const targetCaloriesHigh = Math.round(tdeeHigh - calorieDeficit);

  return {
    bmr,
    bmr_low: bmrLow,
    bmr_high: bmrHigh,
    tdee,
    tdee_low: tdeeLow,
    tdee_high: tdeeHigh,
    target_calories: targetCalories,
    target_calories_low: targetCaloriesLow,
    target_calories_high: targetCaloriesHigh,
    protein_target_g: 0, // Will be set separately based on weight
  };
}

/**
 * Calculate full TDEE from user settings and activity level
 */
export function calculateFullTDEE(
  settings: Pick<UserSettings, 'weight_kg' | 'height_cm' | 'age_years' | 'sex' | 'calorie_deficit'>,
  activityLevel: ActivityLevelOption
): TDEECalculation | null {
  if (!settings.weight_kg || !settings.height_cm || !settings.age_years || !settings.sex) {
    return null;
  }

  const { bmr, bmr_low, bmr_high } = calculateBMR(
    settings.weight_kg,
    settings.height_cm,
    settings.age_years,
    settings.sex
  );

  const tdeeCalc = calculateTDEE(
    bmr,
    bmr_low,
    bmr_high,
    activityLevel.multiplier,
    activityLevel.multiplier_low,
    activityLevel.multiplier_high,
    settings.calorie_deficit
  );

  // Protein target: 1.6g per kg of body weight
  const proteinTarget = Math.round(settings.weight_kg * 1.6);

  return {
    ...tdeeCalc,
    protein_target_g: proteinTarget,
  };
}

/**
 * Default activity levels (matches database seed)
 */
export const DEFAULT_ACTIVITY_LEVELS: ActivityLevelOption[] = [
  {
    id: 1,
    label: 'Rest day',
    description: 'Sedentary, little to no exercise',
    multiplier: 1.2,
    multiplier_low: 1.15,
    multiplier_high: 1.25,
  },
  {
    id: 2,
    label: 'Light activity',
    description: 'Light exercise or walking',
    multiplier: 1.375,
    multiplier_low: 1.3,
    multiplier_high: 1.45,
  },
  {
    id: 3,
    label: 'Moderate activity',
    description: 'Moderate exercise',
    multiplier: 1.55,
    multiplier_low: 1.5,
    multiplier_high: 1.6,
  },
  {
    id: 4,
    label: 'Active day',
    description: 'Hard exercise or physical work',
    multiplier: 1.725,
    multiplier_low: 1.65,
    multiplier_high: 1.8,
  },
  {
    id: 5,
    label: 'Very active',
    description: 'Very hard exercise or intense physical job',
    multiplier: 1.9,
    multiplier_low: 1.8,
    multiplier_high: 2.0,
  },
];

/**
 * Get activity level by ID
 */
export function getActivityLevelById(id: number): ActivityLevelOption | undefined {
  return DEFAULT_ACTIVITY_LEVELS.find(level => level.id === id);
}
