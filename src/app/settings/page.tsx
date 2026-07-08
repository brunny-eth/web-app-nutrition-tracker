'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Supplement } from '@/types/database';

interface Settings {
  id: string;
  name: string;
  weight_kg: number | null;
  height_cm: number | null;
  age_years: number | null;
  sex: 'male' | 'female' | null;
  calorie_deficit: number;
  saturated_fat_percent: number | null;
  protein_g_per_kg: number | null;
  protein_floor_g: number | null;
  supplements: Supplement[] | null;
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
  const [satFatPercent, setSatFatPercent] = useState('');
  const [proteinGPerKg, setProteinGPerKg] = useState('');
  const [proteinFloor, setProteinFloor] = useState('');
  const [supplements, setSupplements] = useState<Supplement[]>([]);
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
      setSatFatPercent(s.saturated_fat_percent?.toString() || '7');
      setProteinGPerKg(s.protein_g_per_kg?.toString() || '1.8');
      setProteinFloor(s.protein_floor_g?.toString() || '150');
      setSupplements(s.supplements || []);
      setTimezone(s.timezone || 'America/New_York');
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // --- Supplement list editing ---
  const slugify = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'supplement';

  const addSupplement = () => {
    setSupplements((prev) => [...prev, { id: `new_${prev.length}`, name: '', detail: '' }]);
  };

  const updateSupplement = (index: number, field: 'name' | 'detail', value: string) => {
    setSupplements((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const removeSupplement = (index: number) => {
    setSupplements((prev) => prev.filter((_, i) => i !== index));
  };

  // Drop blank rows. Preserve existing ids (so checklist history stays linked);
  // only generate a stable id for newly-added rows.
  const cleanedSupplements = (): Supplement[] => {
    const seen = new Set<string>();
    return supplements
      .filter((s) => s.name.trim())
      .map((s) => {
        let id = s.id && !s.id.startsWith('new_') ? s.id : slugify(s.name);
        while (seen.has(id)) id = `${id}_`;
        seen.add(id);
        return { id, name: s.name.trim(), detail: s.detail?.trim() || undefined };
      });
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
          saturated_fat_percent: satFatPercent ? parseFloat(satFatPercent) : 7,
          protein_g_per_kg: proteinGPerKg ? parseFloat(proteinGPerKg) : 1.8,
          protein_floor_g: proteinFloor ? parseInt(proteinFloor) : 150,
          supplements: cleanedSupplements(),
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
              Goals &amp; Targets
            </h2>
            <div className="space-y-4">
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
                  placeholder="300"
                />
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Subtracted from TDEE. Use 0 for maintenance, negative for surplus.
                </p>
              </div>

              <div>
                <label htmlFor="satFat" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Saturated Fat Limit (% of calories)
                </label>
                <input
                  id="satFat"
                  type="number"
                  step="0.5"
                  value={satFatPercent}
                  onChange={(e) => setSatFatPercent(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="7"
                />
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Daily saturated fat cap as a percentage of calories (e.g. 7%).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="proteinPerKg" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Protein (g per kg)
                  </label>
                  <input
                    id="proteinPerKg"
                    type="number"
                    step="0.1"
                    value={proteinGPerKg}
                    onChange={(e) => setProteinGPerKg(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="1.8"
                  />
                </div>
                <div>
                  <label htmlFor="proteinFloor" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Protein Floor (g)
                  </label>
                  <input
                    id="proteinFloor"
                    type="number"
                    value={proteinFloor}
                    onChange={(e) => setProteinFloor(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    placeholder="150"
                  />
                </div>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Protein target = max(weight × g/kg, floor). With your weight, the higher of the two applies.
              </p>
            </div>
          </section>

          {/* Supplements Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Supplements
              </h2>
              <button
                type="button"
                onClick={addSupplement}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                + Add
              </button>
            </div>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              These appear as daily toggles on your dashboard. Add, rename, or remove as your stack changes.
            </p>
            {supplements.length === 0 ? (
              <p className="text-sm text-zinc-400">No supplements yet. Click “Add” to create one.</p>
            ) : (
              <div className="space-y-3">
                {supplements.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateSupplement(i, 'name', e.target.value)}
                        placeholder="Name (e.g. Creatine)"
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={s.detail || ''}
                        onChange={(e) => updateSupplement(i, 'detail', e.target.value)}
                        placeholder="Detail (e.g. 5g, AM with water)"
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSupplement(i)}
                      aria-label="Remove supplement"
                      className="mt-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
