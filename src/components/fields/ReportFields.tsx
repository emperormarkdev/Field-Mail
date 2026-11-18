import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ImagePlus, Loader2, Pencil, Plus, TextQuote, X } from 'lucide-react';
import type { Field, FieldValue, StoredPhoto } from '../../types';
import { DEFAULT_SNIPPETS } from '../../db/starters';
import { Field as FormField, Input, Select, Textarea } from '../ui/Field';
import { cn } from '../../lib/cn';
import { blobUrl } from '../../lib/photos';

export interface FieldControlProps {
  field: Field;
  value: FieldValue;
  error?: string;
  photos: StoredPhoto[];
  busyFieldId: string | null;
  snippets?: string[];
  onAddSnippet?: (phrase: string) => void;
  onRemoveSnippet?: (phrase: string) => void;
  onValueChange: (fieldId: string, value: FieldValue) => void;
  onBlur: () => void;
  onAddPhotos: (fieldId: string, files: File[]) => void;
  onRemovePhoto: (photo: StoredPhoto) => void;
  onMarkupPhoto?: (photo: StoredPhoto) => void;
  onCaptionChange: (photo: StoredPhoto, caption: string) => void;
}

export function FieldControl({
  field,
  value,
  error,
  photos,
  busyFieldId,
  snippets = DEFAULT_SNIPPETS,
  onAddSnippet,
  onRemoveSnippet,
  onValueChange,
  onBlur,
  onAddPhotos,
  onRemovePhoto,
  onMarkupPhoto,
  onCaptionChange,
}: FieldControlProps) {
  const id = `field-${field.id}`;
  const set = (next: FieldValue) => onValueChange(field.id, next);

  if (field.type === 'photo') {
    return (
      <PhotoField
        field={field}
        photos={photos}
        busy={busyFieldId === field.id}
        error={error}
        onAddPhotos={onAddPhotos}
        onRemovePhoto={onRemovePhoto}
        onMarkupPhoto={onMarkupPhoto}
        onCaptionChange={onCaptionChange}
      />
    );
  }

  if (field.type === 'long') {
    const currentText = typeof value === 'string' ? value : '';
    return (
      <div className="flex flex-col gap-2">
        <FormField
          label={field.label}
          htmlFor={id}
          required={field.required}
          hint={field.help}
          error={error}
        >
          <Textarea
            id={id}
            value={currentText}
            onChange={(event) => set(event.target.value)}
            onBlur={onBlur}
            aria-invalid={!!error}
            rows={4}
            enterKeyHint="enter"
            autoCapitalize="sentences"
            autoCorrect="on"
          />
        </FormField>
        <SnippetBar
          snippets={snippets}
          onInsert={(phrase) => {
            const sep = currentText.trim().length > 0 ? '\n' : '';
            set(`${currentText.trimEnd()}${sep}${phrase}`);
            onBlur();
          }}
          onAddSnippet={onAddSnippet}
          onRemoveSnippet={onRemoveSnippet}
        />
      </div>
    );
  }

  if (field.type === 'checklist') {
    const checked = Array.isArray(value) ? value : [];
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-body-medium text-ink">
          {field.label}
          {field.required && (
            <span className="ms-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </legend>
        {field.help && <p className="-mt-1 mb-1 text-body-2-regular text-muted">{field.help}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((option) => {
            const on = checked.includes(option);
            return (
              <label
                key={option}
                className={cn(
                  'press flex min-h-10 cursor-pointer items-center gap-2.5 rounded-field border px-3 py-2',
                  on ? 'border-accent/45 bg-accent-soft' : 'border-line-strong bg-surface hover:bg-raised',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--c-accent)]"
                  checked={on}
                  onChange={() =>
                    set(on ? checked.filter((item) => item !== option) : [...checked, option])
                  }
                  onBlur={onBlur}
                />
                <span className="text-body-medium text-ink">{option}</span>
              </label>
            );
          })}
        </div>
        {error && (
          <p className="text-body-2-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    );
  }

  if (field.type === 'dropdown') {
    return (
      <FormField
        label={field.label}
        htmlFor={id}
        required={field.required}
        hint={field.help}
        error={error}
      >
        <Select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => set(event.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
        >
          <option value="">Select an option</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormField>
    );
  }

  const type =
    field.type === 'number'
      ? 'number'
      : field.type === 'date'
        ? 'date'
        : field.type === 'time'
          ? 'time'
          : 'text';

  return (
    <FormField
      label={field.label}
      htmlFor={id}
      required={field.required}
      hint={field.help}
      error={error}
    >
      <Input
        id={id}
        type={type}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => set(event.target.value)}
        onBlur={onBlur}
        aria-invalid={!!error}
      />
    </FormField>
  );
}

function SnippetBar({
  snippets,
  onInsert,
  onAddSnippet,
  onRemoveSnippet,
}: {
  snippets: string[];
  onInsert: (phrase: string) => void;
  onAddSnippet?: (phrase: string) => void;
  onRemoveSnippet?: (phrase: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onAddSnippet?.(clean);
    onInsert(clean);
    setDraft('');
    setAdding(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press inline-flex cursor-pointer items-center gap-1.5 text-caption-1-semibold text-accent hover:underline"
      >
        <TextQuote aria-hidden className="size-3.5" />
        {open ? 'Hide saved phrases' : 'Insert saved phrase'}
      </button>

      {open && (
        <div className="mt-2 rounded-field border border-line bg-raised p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {snippets.map((phrase) => (
              <span
                key={phrase}
                className="inline-flex items-center rounded-chip border border-line-strong bg-surface text-caption-1-medium text-ink"
              >
                <button
                  type="button"
                  onClick={() => onInsert(phrase)}
                  className="press cursor-pointer px-2.5 py-1 text-start hover:text-accent"
                >
                  + {phrase}
                </button>
                {onRemoveSnippet && (
                  <button
                    type="button"
                    onClick={() => onRemoveSnippet(phrase)}
                    aria-label={`Remove phrase: ${phrase}`}
                    className="press cursor-pointer border-s border-line px-1.5 py-1 text-muted hover:text-danger"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {onAddSnippet && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="press inline-flex cursor-pointer items-center gap-1 rounded-chip border border-dashed border-accent/50 bg-accent-soft px-2.5 py-1 text-caption-1-semibold text-accent"
              >
                <Plus aria-hidden className="size-3" />
                New phrase
              </button>
            )}
          </div>

          {adding && (
            <form onSubmit={handleAdd} className="mt-2 flex gap-1.5">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a reusable phrase…"
                className="min-h-8 text-body-2-regular"
                autoFocus
              />
              <button
                type="submit"
                className="press shrink-0 cursor-pointer rounded-field bg-button-primary px-3 text-caption-1-semibold text-text-white"
              >
                Save & insert
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="press shrink-0 cursor-pointer rounded-field border border-line-strong bg-surface px-2.5 text-caption-1-medium text-muted"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoField({
  field,
  photos,
  busy,
  error,
  onAddPhotos,
  onRemovePhoto,
  onMarkupPhoto,
  onCaptionChange,
}: {
  field: Field;
  photos: StoredPhoto[];
  busy: boolean;
  error?: string;
  onAddPhotos: (fieldId: string, files: File[]) => void;
  onRemovePhoto: (photo: StoredPhoto) => void;
  onMarkupPhoto?: (photo: StoredPhoto) => void;
  onCaptionChange: (photo: StoredPhoto, caption: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onAddPhotos(field.id, files);
    event.target.value = '';
  };

  return (
    <section aria-labelledby={`photos-${field.id}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id={`photos-${field.id}`} className="text-body-medium text-ink">
            {field.label}
            {field.required && (
              <span className="ms-1 text-danger" aria-hidden>
                *
              </span>
            )}
          </h3>
          {field.help && <p className="mt-0.5 text-body-2-regular text-muted">{field.help}</p>}
        </div>
        {photos.length > 0 && (
          <span className="text-body-2-medium text-muted">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-raised">
                <img
                  src={blobUrl(photo.thumb)}
                  alt={photo.caption || 'Report photo'}
                  className="size-full object-cover"
                  loading="lazy"
                />
                {onMarkupPhoto && (
                  <button
                    type="button"
                    onClick={() => onMarkupPhoto(photo)}
                    className="press absolute start-1.5 top-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-black/70 px-2.5 text-caption-2-semibold text-white hover:bg-black/85"
                  >
                    <Pencil aria-hidden className="size-3" />
                    Mark up
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo)}
                  aria-label="Remove photo"
                  className="press absolute end-1.5 top-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-black/70 text-white hover:bg-black/85"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
              <div className="p-2">
                <label className="sr-only" htmlFor={`caption-${photo.id}`}>
                  Caption
                </label>
                <input
                  id={`caption-${photo.id}`}
                  value={photo.caption}
                  onChange={(event) => onCaptionChange(photo, event.target.value)}
                  placeholder="Caption"
                  className="min-h-8 w-full rounded-field border border-line bg-raised px-2.5 py-1 text-body-2-regular text-ink placeholder:text-text-placeholder focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={pick}
          aria-label="Choose photos from gallery"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={pick}
          aria-label="Take a photo"
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="press inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-field border border-line-strong bg-surface px-3.5 text-body-medium text-ink hover:bg-raised disabled:opacity-50"
        >
          {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Camera aria-hidden className="size-4" />}
          Take photo
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          className="press inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-field border border-line-strong bg-surface px-3.5 text-body-medium text-ink hover:bg-raised disabled:opacity-50"
        >
          <ImagePlus aria-hidden className="size-4" />
          Choose files
        </button>
      </div>

      {error && (
        <p className="mt-2 text-body-2-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
