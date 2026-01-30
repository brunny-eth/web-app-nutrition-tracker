'use client';

import { useState, useRef, useCallback } from 'react';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

interface FoodEntryFormProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onEntryCreated: () => void;
  today: string;
  yesterday: string;
}

export function FoodEntryForm({ 
  selectedDate, 
  onDateChange, 
  onEntryCreated,
  today,
  yesterday,
}: FoodEntryFormProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setImageName(file.name);
      setError('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageFile(file);
    }
  }, [handleImageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  }, [handleImageFile]);

  const removeImage = () => {
    setImage(null);
    setImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !image) || loading) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text.trim() || (image ? '1 serving' : ''),
          image: image || undefined,
          client_timestamp: new Date().toISOString(),
          override_date: selectedDate !== today ? selectedDate : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log food');
      }

      setText('');
      setImage(null);
      setImageName('');
      onEntryCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = text.trim() || image;

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
          placeholder={image 
            ? "Add details (optional) - e.g., '2 servings' or 'half portion'"
            : "Log food here, or drag & drop a photo of nutrition facts/menu. The more details you include, the better. You can do 1 big message daily or split up each time, your choice."
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

      {/* Image preview */}
      {image && (
        <div className="relative inline-block">
          <img 
            src={image} 
            alt="Preview" 
            className="h-20 w-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="mt-1 text-xs text-zinc-500 truncate max-w-[150px]">{imageName}</p>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex gap-2">
        {/* Photo button (mobile-friendly) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Add photo of nutrition facts or menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Photo</span>
        </button>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <LoadingSpinner />
              Parsing...
            </>
          ) : (
            'Log Food'
          )}
        </button>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2">
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

      {/* Helper text for photos */}
      {!image && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Tip: Use photos for nutrition labels or menus only (not photos of food)
        </p>
      )}

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
