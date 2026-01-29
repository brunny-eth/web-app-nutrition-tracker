'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  id: string;
  name: string;
  weight_kg: number | null;
  height_cm: number | null;
  age_years: number | null;
  sex: 'male' | 'female' | null;
  calorie_deficit: number;
  timezone: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [calorieDeficit, setCalorieDeficit] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.status === 401) {
        router.push('/');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch settings');
      
      const data = await res.json();
      const s: Settings = data.settings;
      
      setName(s.name || '');
      setWeightKg(s.weight_kg?.toString() || '');
      setHeightCm(s.height_cm?.toString() || '');
      setAgeYears(s.age_years?.toString() || '');
      setSex(s.sex || '');
      setCalorieDeficit(s.calorie_deficit?.toString() || '500');
      setTimezone(s.timezone || 'America/New_York');
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    // Validate password change
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        setSaving(false);
        return;
      }
      if (!currentPassword) {
        setError('Current password required to change password');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          age_years: ageYears ? parseInt(ageYears) : null,
          sex: sex || null,
          calorie_deficit: parseInt(calorieDeficit) || 500,
          timezone,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Settings
          </h1>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={handleSave} className="space-y-8">
          {/* Profile Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Profile
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </section>

          {/* Body Stats Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Body Stats
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Used for TDEE and calorie target calculations
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Weight (kg)
                </label>
                <input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="70"
                />
              </div>
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Height (cm)
                </label>
                <input
                  id="height"
                  type="number"
                  step="0.1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="175"
                />
              </div>
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Age (years)
                </label>
                <input
                  id="age"
                  type="number"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="30"
                />
              </div>
              <div>
                <label htmlFor="sex" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Sex
                </label>
                <select
                  id="sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female' | '')}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </section>

          {/* Goals Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Goals
            </h2>
            <div>
              <label htmlFor="deficit" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Daily Calorie Deficit
              </label>
              <input
                id="deficit"
                type="number"
                value={calorieDeficit}
                onChange={(e) => setCalorieDeficit(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="500"
              />
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Subtracted from TDEE. Use 0 for maintenance, negative for surplus.
              </p>
            </div>
          </section>

          {/* Timezone Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Timezone
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Used for date resolution when logging meals
            </p>
            <div>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="America/New_York">Eastern Time (New York)</option>
                <option value="America/Chicago">Central Time (Chicago)</option>
                <option value="America/Denver">Mountain Time (Denver)</option>
                <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris / Central Europe</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Australia/Sydney">Sydney</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </section>

          {/* Password Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Change Password
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Leave blank to keep current password
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </section>

          {/* Messages */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  );
}
