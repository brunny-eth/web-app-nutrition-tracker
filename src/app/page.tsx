'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { FoodEntryForm } from '@/components/FoodEntryForm';
import { DailySummary } from '@/components/DailySummary';
import { EntryList } from '@/components/EntryList';
import { ActivitySelector, type ActivityData } from '@/components/ActivitySelector';
import { DailyChecklist, type ChecklistData } from '@/components/DailyChecklist';
import { proteinTargetGrams, resolveActivityMultiplier } from '@/lib/tdee';
import { aggregateItems } from '@/lib/aggregation';
import { SavedMealList, type SavedMeal } from '@/components/SavedMealList';
import { supplementFiberBonus } from '@/lib/supplements';
import type { Supplement } from '@/types/database';

interface AuthStatus {
  authenticated: boolean;
  isSetUp: boolean;
  settings: {
    name: string;
    weight_kg: number | null;
    height_cm: number | null;
    age_years: number | null;
    sex: 'male' | 'female' | null;
    calorie_deficit: number;
    saturated_fat_percent: number;
    protein_g_per_kg: number;
    protein_floor_g: number;
    supplements: Supplement[];
    timezone: string;
  } | null;
}

interface Entry {
  id: string;
  raw_text: string;
  created_at: string;
  resolved_date: string;
  entry_items: {
    id: string;
    food_name: string;
    calories: number;
    calories_low: number;
    calories_high: number;
    protein_g: number;
    protein_low: number;
    protein_high: number;
    carbs_g: number;
    carbs_low: number;
    carbs_high: number;
    fat_g: number;
    fat_low: number;
    fat_high: number;
    saturated_fat_g: number;
    saturated_fat_low: number;
    saturated_fat_high: number;
    fiber_g: number;
    fiber_low: number;
    fiber_high: number;
    added_sugar_g: number;
    added_sugar_low: number;
    added_sugar_high: number;
    sodium_mg: number;
    sodium_low: number;
    sodium_high: number;
    potassium_mg: number;
    potassium_low: number;
    potassium_high: number;
    grams: number | null;
    assumptions: string[];
  }[];
}

export default function Home() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [today, setToday] = useState('');
  const [yesterday, setYesterday] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData>({ supplements_taken: [], alcohol: false, weight_kg: null, bp_systolic: null, bp_diastolic: null });
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Initialize dates after auth
  useEffect(() => {
    if (authStatus?.authenticated) {
      const tz = authStatus.settings?.timezone || 'America/New_York';
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD format
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: tz });
      
      setToday(todayStr);
      setYesterday(yesterdayStr);
      setSelectedDate(todayStr);
    }
  }, [authStatus]);

  // Fetch entries when date changes
  useEffect(() => {
    if (selectedDate && authStatus?.authenticated) {
      fetchEntries();
      fetchActivity();
      fetchChecklist();
      fetchSavedMeals();
    }
  }, [selectedDate, authStatus?.authenticated]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthStatus({ authenticated: false, isSetUp: false, settings: null });
    } finally {
      setLoading(false);
    }
  };

  // Saved meals aren't date-scoped — they persist until removed.
  const fetchSavedMeals = async () => {
    try {
      const res = await fetch('/api/saved-meals');
      if (!res.ok) return;
      const data = await res.json();
      setSavedMeals(data.saved_meals || []);
    } catch (error) {
      console.error('Failed to fetch saved meals:', error);
    }
  };

  const fetchEntries = async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/entries?date=${selectedDate}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await fetch(`/api/activity?date=${selectedDate}`);
      const data = await res.json();
      const activity = data.activity;
      if (activity?.multiplier) {
        // New-style: LLM-estimated multiplier
        setActivityData({
          multiplier: activity.multiplier,
          multiplier_low: activity.multiplier_low ?? activity.multiplier,
          multiplier_high: activity.multiplier_high ?? activity.multiplier,
          summary: activity.summary ?? undefined,
          description: activity.description ?? undefined,
        });
      } else if (activity?.activity_level_id) {
        // Old-style: map activity_level_id to multiplier for backward compat. A legacy
        // level carries no range, so low/high collapse onto the point estimate.
        const m = resolveActivityMultiplier(activity);
        setActivityData({ multiplier: m, multiplier_low: m, multiplier_high: m });
      } else {
        setActivityData(null);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  };

  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/checklist?date=${selectedDate}`);
      const data = await res.json();
      const c = data.checklist;
      setChecklist({
        supplements_taken: c?.supplements_taken ?? [],
        alcohol: c?.alcohol ?? false,
        weight_kg: c?.weight_kg ?? null,
        bp_systolic: c?.bp_systolic ?? null,
        bp_diastolic: c?.bp_diastolic ?? null,
      });
    } catch (error) {
      console.error('Failed to fetch checklist:', error);
      setChecklist({ supplements_taken: [], alcohol: false, weight_kg: null, bp_systolic: null, bp_diastolic: null });
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthStatus({ authenticated: false, isSetUp: true, settings: null });
    setEntries([]);
  };

  const handleEntryDeleted = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));

  };

  // Calculate totals from entries
  const totals = aggregateItems(entries.flatMap((entry) => entry.entry_items));

  // Fold psyllium's fiber into the total when it's ticked in today's checklist.
  // Recomputes on every render, so the fiber card ticks up the instant the toggle flips.
  const fiberBonus = supplementFiberBonus(
    authStatus?.settings?.supplements,
    checklist.supplements_taken
  );
  totals.fiber.value += fiberBonus;
  totals.fiber.low += fiberBonus;
  totals.fiber.high += fiberBonus;

  // Calculate TDEE targets if settings available
  let targetCalories: number | undefined;
  let tdeeCalories: number | undefined;
  let bmrCalories: number | undefined;
  let targetProtein: number | undefined;

  if (authStatus?.settings) {
    const { weight_kg, height_cm, age_years, sex, calorie_deficit } = authStatus.settings;
    if (weight_kg && height_cm && age_years && sex) {
      // Mifflin-St Jeor
      let bmr: number;
      if (sex === 'male') {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age_years + 5;
      } else {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age_years - 161;
      }
      // Use activity multiplier directly (default to moderate 1.55)
      const multiplier = activityData?.multiplier ?? 1.55;
      const tdee = bmr * multiplier;
      bmrCalories = Math.round(bmr);
      tdeeCalories = Math.round(tdee);
      targetCalories = Math.round(tdee - calorie_deficit);
      targetProtein = proteinTargetGrams(
        weight_kg,
        authStatus.settings.protein_g_per_kg,
        authStatus.settings.protein_floor_g
      );
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Auth required
  if (!authStatus?.authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
          <LoginForm onSuccess={checkAuth} isSetUp={authStatus?.isSetUp || false} />
        </div>
      </div>
    );
  }

  // Main app
  const dateLabel = selectedDate === today ? 'Today' : selectedDate === yesterday ? 'Yesterday' : selectedDate;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Nutrition
            </h1>
            {authStatus?.settings?.name && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Hi, {authStatus.settings.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/trends')}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Trends
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-6">
          {/* Food Entry Form */}
          <section>
            <FoodEntryForm
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onEntryCreated={fetchEntries}
              onSavedMealCreated={fetchSavedMeals}
              today={today}
              yesterday={yesterday}
            />
          </section>

          <SavedMealList
            savedMeals={savedMeals}
            selectedDate={selectedDate}
            today={today}
            onLogged={fetchEntries}
            onRemoved={fetchSavedMeals}
          />

          {/* Activity Selector */}
          <ActivitySelector
            currentActivity={activityData}
            date={selectedDate}
            onSelect={setActivityData}
          />

          {/* Supplement & Alcohol Checklist */}
          <DailyChecklist
            supplements={authStatus.settings?.supplements ?? []}
            date={selectedDate}
            checklist={checklist}
            onChange={setChecklist}
          />

          {/* Daily Summary */}
          <section>
            <DailySummary
              calories={totals.calories}
              protein={totals.protein}
              saturatedFat={totals.saturatedFat}
              fiber={totals.fiber}
              addedSugar={totals.addedSugar}
              sodium={totals.sodium}
              potassium={totals.potassium}
              targetCalories={targetCalories}
              tdee={tdeeCalories}
              bmr={bmrCalories}
              targetProtein={targetProtein}
              satFatPercent={authStatus.settings?.saturated_fat_percent}
              sex={authStatus.settings?.sex}
            />
          </section>

          {/* Entries List */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {dateLabel}&apos;s Entries
              </h2>
              {loadingEntries && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              )}
            </div>
            <EntryList entries={entries} onDelete={handleEntryDeleted} onUpdate={fetchEntries} />
          </section>
        </div>
      </main>
    </div>
  );
}
