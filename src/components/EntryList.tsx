'use client';

import { useState } from 'react';

interface FoodItem {
  id: string;
  food_name: string;
  calories: number;
  calories_low: number;
  calories_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  added_sugar_g: number;
  sodium_mg: number;
  grams: number | null;
  assumptions: string[];
  has_override?: boolean;
  override_fields?: string[];
}

interface Entry {
  id: string;
  raw_text: string;
  created_at: string;
  resolved_date: string;
  entry_items: FoodItem[];
}

interface EntryListProps {
  entries: Entry[];
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export function EntryList({ entries, onDelete, onUpdate }: EntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-500 dark:text-zinc-400">
          No food logged yet. Start by entering what you ate above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

interface EntryCardProps {
  entry: Entry;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

function EntryCard({ entry, onDelete, onUpdate }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalCalories = entry.entry_items.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = entry.entry_items.reduce((sum, item) => sum + item.protein_g, 0);

  const handleDelete = async () => {
    if (!confirm('Delete this entry?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(entry.id);
      }
    } finally {
      setDeleting(false);
    }
  };

  const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{time}</span>
            <span>•</span>
            <span>{entry.entry_items.length} item{entry.entry_items.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100 truncate">
            {entry.raw_text}
          </p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {Math.round(totalCalories)} kcal
            </span>
            <span className="text-green-600 dark:text-green-400">
              {Math.round(totalProtein)}g protein
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title={expanded ? 'Collapse' : 'Expand to edit'}
          >
            <svg
              className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
            title="Delete entry"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="space-y-3">
            {entry.entry_items.map((item) => (
              <FoodItemRow key={item.id} item={item} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FoodItemRowProps {
  item: FoodItem;
  onUpdate: () => void;
}

function FoodItemRow({ item, onUpdate }: FoodItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Edit form state
  const [foodName, setFoodName] = useState(item.food_name);
  const [calories, setCalories] = useState(item.calories.toString());
  const [protein, setProtein] = useState(item.protein_g.toString());
  const [carbs, setCarbs] = useState(item.carbs_g.toString());
  const [fat, setFat] = useState(item.fat_g.toString());
  const [fiber, setFiber] = useState((item.fiber_g || 0).toString());

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_name: foodName,
          calories: parseFloat(calories) || 0,
          protein_g: parseFloat(protein) || 0,
          carbs_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
          fiber_g: parseFloat(fiber) || 0,
        }),
      });

      if (res.ok) {
        setEditing(false);
        onUpdate();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this item?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/items/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        onUpdate();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setFoodName(item.food_name);
    setCalories(item.calories.toString());
    setProtein(item.protein_g.toString());
    setCarbs(item.carbs_g.toString());
    setFat(item.fat_g.toString());
    setFiber((item.fiber_g || 0).toString());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Calories</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Protein (g)</label>
              <input
                type="number"
                step="0.1"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Carbs (g)</label>
              <input
                type="number"
                step="0.1"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Fat (g)</label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Fiber (g)</label>
              <input
                type="number"
                step="0.1"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {/* Main row */}
      <div className="flex items-start justify-between gap-4">
        {/* Left side: food name, weight, assumptions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.food_name}</p>
            {item.has_override && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                edited
              </span>
            )}
          </div>
          
          {item.grams && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">~{Math.round(item.grams)}g</p>
          )}

          {/* Assumptions */}
          {item.assumptions && item.assumptions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.assumptions.map((assumption, i) => (
                <span
                  key={i}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                >
                  {assumption}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: all nutrition stats + action icons */}
        <div className="flex items-start gap-3">
          {/* Nutrition stats grid */}
          <div className="text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {/* Calories - prominent */}
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {Math.round(item.calories)} kcal
            </p>
            
            {/* All other stats in uniform style */}
            <div className="mt-1 flex justify-end gap-x-3">
              <span>Protein {Math.round(item.protein_g)}g</span>
              <span>Carbs {Math.round(item.carbs_g)}g</span>
            </div>
            <div className="flex justify-end gap-x-3">
              <span>Fiber {Math.round(item.fiber_g || 0)}g</span>
              <span>Sugar {Math.round(item.added_sugar_g || 0)}g</span>
            </div>
            <div className="flex justify-end gap-x-3">
              <span>Sat Fat {Math.round(item.saturated_fat_g || 0)}g</span>
              <span>Sodium {Math.round(item.sodium_mg || 0)}mg</span>
            </div>
          </div>

          {/* Action icon buttons */}
          <div className="flex flex-col gap-3.5">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
              title="Edit item"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Delete item"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
