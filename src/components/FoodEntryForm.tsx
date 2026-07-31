'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { IMAGE_ONLY_TEXT } from '@/types/nutrition';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

/**
 * A recent meal, split into what the dropdown shows and what gets inserted.
 * A day logged as one long multi-line message makes a useless label, so the two
 * can't be the same string.
 */
interface RecentMeal {
  /** One line, length-capped, for the dropdown row. */
  label: string;
  /** The original text, inserted verbatim when picked. */
  text: string;
}

interface AttachedImage {
  /** Compressed data URL. */
  dataUrl: string;
  name: string;
}

/**
 * Each compressed image is ~200-500KB, and base64 inflates that by a third inside a
 * JSON body. Capped so a multi-page recipe can't exceed the serverless request
 * body limit, which would fail as an opaque network error.
 */
const MAX_BATCH_IMAGES = 4;

const RECENT_LABEL_MAX_CHARS = 80;

/**
 * Collapse newlines and cap the length. Row height is then bounded by the data
 * rather than by CSS line clamping, which was sizing each row to the height of the
 * full untruncated text and leaving tall blank gaps under long entries.
 */
function toRecentLabel(rawText: string): string {
  const oneLine = rawText.replace(/\s+/g, ' ').trim();
  return oneLine.length > RECENT_LABEL_MAX_CHARS
    ? `${oneLine.slice(0, RECENT_LABEL_MAX_CHARS).trimEnd()}…`
    : oneLine;
}

interface FoodEntryFormProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onEntryCreated: () => void;
  /** A saved batch isn't food eaten, so it refreshes the batch list, not the day. */
  onBatchCreated: () => void;
  today: string;
  yesterday: string;
}

export function FoodEntryForm({
  selectedDate,
  onDateChange,
  onEntryCreated,
  onBatchCreated,
  today,
  yesterday,
}: FoodEntryFormProps) {
  const [text, setText] = useState('');
  // An array because a recipe often spans several screenshots. The meal path still
  // sends only the first; multi-image is what batch parsing needs.
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [isBatch, setIsBatch] = useState(false);
  const [batchTotal, setBatchTotal] = useState('');
  const [batchUnit, setBatchUnit] = useState('cups');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recentDropdownRef = useRef<HTMLDivElement>(null);

  // Close recent dropdown on outside click
  useEffect(() => {
    if (!showRecent) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (recentDropdownRef.current && !recentDropdownRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRecent]);

  const fetchRecentMeals = async () => {
    setLoadingRecent(true);
    try {
      const fromDate = new Date(today + 'T00:00:00');
      fromDate.setDate(fromDate.getDate() - 13); // 14 days back
      const fromStr = fromDate.toISOString().split('T')[0];
      const res = await fetch(`/api/entries?from=${fromStr}&to=${today}`);
      const data = await res.json();
      const seen = new Set<string>();
      const unique: RecentMeal[] = [];
      // Matches IMAGE_ONLY_TEXT plus the "2 servings" variants older rows may carry —
      // those describe a photo, not a meal, so they're useless as suggestions.
      const imageOnlyPattern = /^\d*\.?\d*\s*servings?$/i;
      for (const entry of (data.entries || [])) {
        const text = (entry.raw_text ?? '').trim();
        const label = toRecentLabel(text);
        // Dedupe on the label so two logs differing only in line breaks collapse
        // into one suggestion. Skips blanks, which used to render as empty rows.
        if (label && !seen.has(label) && !imageOnlyPattern.test(label)) {
          seen.add(label);
          unique.push({ label, text });
        }
        if (unique.length >= 8) break;
      }
      setRecentMeals(unique);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleOpenRecent = () => {
    const next = !showRecent;
    setShowRecent(next);
    if (next) fetchRecentMeals();
  };

  const handleSelectRecent = (mealText: string) => {
    setText(mealText);
    setShowRecent(false);
    textareaRef.current?.focus();
  };

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    if (file.size > 20 * 1024 * 1024) { // 20MB limit for original
      setError('Image must be less than 20MB');
      return;
    }

    // Compress and resize image before upload
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Recipe screenshots are dense text, so they get more pixels to stay legible
      // than a nutrition label needs.
      const MAX_DIMENSION = isBatch ? 2000 : 1500;
      const MAX_WIDTH = MAX_DIMENSION;
      const MAX_HEIGHT = MAX_DIMENSION;
      
      let { width, height } = img;
      
      // Scale down if needed
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with 85% quality (good balance of size vs quality)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      
      // Batch mode collects pages of one recipe; meal mode holds a single label.
      setImages((prev) =>
        isBatch ? [...prev, { dataUrl: compressedBase64, name: file.name }].slice(0, MAX_BATCH_IMAGES)
                : [{ dataUrl: compressedBase64, name: file.name }]
      );
      setError('');
    };
    
    img.onerror = () => {
      setError('Failed to load image');
    };
    
    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [isBatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    for (const file of Array.from(e.dataTransfer.files)) {
      handleImageFile(file);
      if (!isBatch) break; // meal mode holds one image
    }
  }, [handleImageFile, isBatch]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files ?? [])) {
      handleImageFile(file);
      if (!isBatch) break;
    }
    // Cleared so re-picking the same file still fires a change event.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleImageFile, isBatch]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setText('');
    setImages([]);
    setBatchTotal('');
  };

  // Batch mode additionally needs a yield — without it there's nothing to divide by.
  const hasInput = Boolean(text.trim() || images.length > 0);
  const batchTotalValid = Number(batchTotal) > 0;
  const canSubmit = isBatch ? hasInput && batchTotalValid : hasInput;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setError('');
    setLoading(true);

    try {
      if (isBatch) {
        // A batch is a source to log portions from, so this deliberately adds
        // nothing to today's totals — hence onBatchCreated, not onEntryCreated.
        const res = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: text.trim(),
            images: images.map((img) => img.dataUrl),
            total_amount: Number(batchTotal),
            unit: batchUnit.trim() || 'cups',
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save batch');
        }
        resetForm();
        onBatchCreated();
        return;
      }

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text.trim() || (images.length > 0 ? IMAGE_ONLY_TEXT : ''),
          image: images[0]?.dataUrl,
          client_timestamp: new Date().toISOString(),
          override_date: selectedDate !== today ? selectedDate : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log food');
      }

      resetForm();
      onEntryCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : isBatch ? 'Failed to save batch' : 'Failed to log food');
    } finally {
      setLoading(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Text area with drag-drop support */}
      <div
        className={`relative rounded-xl border-2 transition-colors ${
          isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
            : 'border-zinc-200 dark:border-zinc-700'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isBatch
              ? "Paste or describe the recipe, and note anything you changed — e.g. 'used 2 lb ground beef instead of 1'. Recipe photos work too."
              : images.length > 0
                ? "Add details (optional) - e.g., '2 servings' or 'half portion'"
                : "Log food here via text or a photo of nutrition facts/menu. The more details you include, the better. You can do 1 big message daily or split up for each meal."
          }
          rows={4}
          className="block w-full resize-none rounded-xl border-0 bg-transparent px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-100"
          disabled={loading}
        />
        
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-blue-50/90 dark:bg-blue-950/90">
            <p className="text-blue-600 dark:text-blue-400 font-medium">Drop image here</p>
          </div>
        )}
      </div>

      {/* Image previews — several in batch mode, since a recipe spans pages */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={`${img.name}-${i}`} className="relative inline-block">
              <img
                src={img.dataUrl}
                alt={`Attachment ${i + 1}`}
                className="h-20 w-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`Remove ${img.name}`}
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="mt-1 max-w-[150px] truncate text-xs text-zinc-500">{img.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Batch mode */}
      <div className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isBatch}
            onChange={(e) => setIsBatch(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            This is a batch I&apos;ll eat over several days
          </span>
        </label>

        {isBatch && (
          <div className="mt-2.5 space-y-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Makes</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={batchTotal}
                onChange={(e) => setBatchTotal(e.target.value)}
                placeholder="12"
                aria-label="Total amount this recipe makes"
                disabled={loading}
                className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                type="text"
                value={batchUnit}
                onChange={(e) => setBatchUnit(e.target.value)}
                aria-label="Unit"
                disabled={loading}
                className="w-24 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-400">total</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Nothing gets added to today. Attach the recipe (photos of it are fine, up to{' '}
              {MAX_BATCH_IMAGES}) and note any changes you made — &quot;used 2 lb beef instead of
              1&quot;. Then log portions from it each time you eat.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex gap-2">
        {/* Photo button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={isBatch}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title={isBatch ? 'Add photos of the recipe' : 'Add photo of nutrition facts or menu'}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Photo</span>
        </button>

        {/* Recent meals dropdown */}
        <div ref={recentDropdownRef} className="relative">
          <button
            type="button"
            onClick={handleOpenRecent}
            disabled={loading}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              showRecent
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
            title="Pick a recent meal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Recent</span>
          </button>

          {showRecent && (
            <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {loadingRecent ? (
                <div className="flex items-center justify-center p-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : recentMeals.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No recent meals found</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto py-1">
                  {recentMeals.map((meal, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleSelectRecent(meal.text)}
                        title={meal.text}
                        className="block w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {meal.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <LoadingSpinner />
              {isBatch ? 'Reading recipe…' : 'Parsing...'}
            </>
          ) : isBatch ? (
            'Save Batch'
          ) : (
            'Log Food'
          )}
        </button>
      </div>

      {/* Date selector — hidden for batches, which aren't eaten on a date */}
      <div className={`flex items-center gap-2 ${isBatch ? 'hidden' : ''}`}>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Log for:</span>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDate === today
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onDateChange(yesterday)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDate === yesterday
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Yesterday
          </button>
          <label
            className={`relative px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              selectedDate !== today && selectedDate !== yesterday
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            {selectedDate !== today && selectedDate !== yesterday
              ? formatDate(selectedDate)
              : 'Pick date'}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              max={today}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
