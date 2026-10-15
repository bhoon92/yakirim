import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { createEvent, deleteEvent, deletePhoto, listEvents, listPhotos, uploadPhoto, type ChurchEvent } from '@/api/gallery';
import { Button } from '@/components/ui/button';
import { PanelToggle } from '@/components/ui/panel-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { EmojiTile } from '@/components/ui/emoji-tile';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/permissions';

export function GalleryPage() {
  const [selected, setSelected] = useState<ChurchEvent | null>(null);
  const { can } = usePermissions();
  const canWrite = can('gallery:write');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="행사" title="행사 갤러리" description="수련회·행사 사진을 행사별 폴더로 관리합니다." />
      {selected ? (
        <EventDetail event={selected} canWrite={canWrite} onBack={() => setSelected(null)} />
      ) : (
        <EventList onOpen={setSelected} canWrite={canWrite} />
      )}
    </div>
  );
}

function EventList({ onOpen, canWrite }: { onOpen: (event: ChurchEvent) => void; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  });

  const createMut = useMutation({
    mutationFn: () => createEvent({ name: name.trim(), date: date || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setName('');
      setDate('');
      setCreating(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <PanelToggle open={creating} onToggle={() => setCreating(!creating)} label="행사 추가" variant="default" />
        </div>
      )}

      {creating && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-5">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">행사명</label>
              <Input value={name} onChange={event => setName(event.target.value)} placeholder="예: 2026 여름 수련회" autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">날짜</label>
              <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="w-44" />
            </div>
            <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
              만들기
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">등록된 행사가 없습니다.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Card key={event.id} className="group cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="p-5" onClick={() => onOpen(event)}>
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <EmojiTile seed={event.name} kind="event" size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{event.name}</div>
                      {event.date && <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{event.date}</div>}
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      onClick={ev => {
                        ev.stopPropagation();
                        if (window.confirm(`"${event.name}" 행사와 사진을 모두 삭제할까요?`)) deleteMut.mutate(event.id);
                      }}
                      className="rounded-full p-1 text-[var(--color-muted-foreground)] opacity-0 transition-opacity hover:bg-[var(--color-muted)] group-hover:opacity-100"
                      aria-label="삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 text-xs text-[var(--color-muted-foreground)]">사진 {event.photoCount}장</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventDetail({ event, canWrite, onBack }: { event: ChurchEvent; canWrite: boolean; onBack: () => void }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', event.id],
    queryFn: () => listPhotos(event.id),
  });

  const deleteMut = useMutation({
    mutationFn: (photoId: number) => deletePhoto(event.id, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', event.id] }),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadPhoto(event.id, file);
      }
      await queryClient.invalidateQueries({ queryKey: ['photos', event.id] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error) {
      setError(error instanceof Error ? error.message : '업로드 실패');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-4" />
          행사 목록
        </button>
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={event => void onFiles(event.target.files)} />
          {canWrite && (
            <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload className="size-3.5" />
              {uploading ? '업로드 중…' : '사진 업로드'}
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{event.name}</h2>
        {event.date && <p className="text-xs text-[var(--color-muted-foreground)]">{event.date}</p>}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div
        className="relative"
        onDragOver={e => {
          e.preventDefault();
          if (canWrite) setDragOver(true);
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          if (canWrite) void onFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary)]/5">
            <Upload className="size-8 text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-primary)]">여기에 놓으세요</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">불러오는 중…</div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-sm text-[var(--color-muted-foreground)]">
              <ImageOff className="size-8 opacity-40" />
              아직 사진이 없습니다.{canWrite ? ' 끌어다 놓거나 우측 상단에서 업로드하세요.' : ''}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map(photo => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]"
              >
                <img src={photo.url} alt={photo.originalName} loading="lazy" className="size-full object-cover" />
                {canWrite && (
                  <button
                    onClick={() => {
                      if (window.confirm('이 사진을 삭제할까요?')) deleteMut.mutate(photo.id);
                    }}
                    className={cn(
                      'absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-opacity',
                      'hover:bg-black/70 group-hover:opacity-100'
                    )}
                    aria-label="삭제"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
