'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { FoodEntryForm } from '@/components/FoodEntryForm';
import { DailySummary } from '@/components/DailySummary';
import { EntryList } from '@/components/EntryList';
import { ActivitySelector } from '@/components/ActivitySelector';

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
  const [activityLevel, setActivityLevel] = useState<number>(3); // Default to Moderate
  const [loadingEntries, setLoadingEntries] = useState(false);

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
      setActivityLevel(data.activity?.activity_level_id || 3); // Default to Moderate
    } catch (error) {
      console.error('Failed to fetch activity:', error);
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
  const totals = entries.reduce(
    (acc, entry) => {
      entry.entry_items.forEach((item) => {
        acc.calories.value += item.calories;
        acc.calories.low += item.calories_low;
        acc.calories.high += item.calories_high;
        acc.protein.value += item.protein_g;
        acc.protein.low += item.protein_low;
        acc.protein.high += item.protein_high;
        acc.carbs.value += item.carbs_g;
        acc.carbs.low += item.carbs_low;
        acc.carbs.high += item.carbs_high;
        acc.fat.value += item.fat_g;
        acc.fat.low += item.fat_low;
        acc.fat.high += item.fat_high;
        acc.saturatedFat.value += item.saturated_fat_g || 0;
        acc.saturatedFat.low += item.saturated_fat_low || 0;
        acc.saturatedFat.high += item.saturated_fat_high || 0;
        acc.fiber.value += item.fiber_g || 0;
        acc.fiber.low += item.fiber_low || 0;
        acc.fiber.high += item.fiber_high || 0;
        acc.addedSugar.value += item.added_sugar_g || 0;
        acc.addedSugar.low += item.added_sugar_low || 0;
        acc.addedSugar.high += item.added_sugar_high || 0;
        acc.sodium.value += item.sodium_mg || 0;
        acc.sodium.low += item.sodium_low || 0;
        acc.sodium.high += item.sodium_high || 0;
      });
      return acc;
    },
    {
      calories: { value: 0, low: 0, high: 0 },
      protein: { value: 0, low: 0, high: 0 },
      carbs: { value: 0, low: 0, high: 0 },
      fat: { value: 0, low: 0, high: 0 },
      saturatedFat: { value: 0, low: 0, high: 0 },
      fiber: { value: 0, low: 0, high: 0 },
      addedSugar: { value: 0, low: 0, high: 0 },
      sodium: { value: 0, low: 0, high: 0 },
    }
  );

  // Calculate TDEE targets if settings available
  let targetCalories: number | undefined;
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
      // Use activity multiplier (default to sedentary if not set)
      const multipliers = [1.2, 1.375, 1.55, 1.725, 1.9];
      const multiplier = activityLevel ? multipliers[activityLevel - 1] : 1.2;
      const tdee = bmr * multiplier;
      targetCalories = Math.round(tdee - calorie_deficit);
      targetProtein = Math.round(weight_kg * 1.6);
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
              today={today}
              yesterday={yesterday}
            />
          </section>

          {/* Activity Selector */}
          <ActivitySelector
            currentLevel={activityLevel}
            date={selectedDate}
            onSelect={setActivityLevel}
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
              targetCalories={targetCalories}
              targetProtein={targetProtein}
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
