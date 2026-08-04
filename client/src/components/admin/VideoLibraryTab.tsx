import { useState } from 'react';
import { Trash2, Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useVideoContents, useDeleteVideoContent, type VideoContent } from "@/hooks/useVideoContent";
import { useCategoryContext } from "@/context/CategoryContext";

export function VideoLibraryTab() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data, isLoading } = useVideoContents(category);
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const deleteVideoContent = useDeleteVideoContent();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<VideoContent | null>(null);

  const videos = data?.items ?? [];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteVideoContent.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: 'Dihapus', description: 'Video berhasil dihapus.' });
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <span className="flex items-center">
              <Film className="h-5 w-5 mr-2" />
              Video Library
            </span>
            <Select value={category ?? 'all'} onValueChange={(v) => setCategory(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {!isCategoryLoading &&
                  Array.from(hierarchy.keys()).sort().map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat video...</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada video yang diupload.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={video.video_url} controls className="w-full aspect-[9/16] bg-black object-contain" />
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium bg-muted rounded px-2 py-0.5 truncate">
                        {video.category}{video.subcategory ? ` / ${video.subcategory}` : ''}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setDeleteTarget(video)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {video.caption && <p className="text-xs line-clamp-3">{video.caption}</p>}
                    {video.hashtags && video.hashtags.length > 0 && (
                      <p className="text-xs text-primary truncate">
                        {video.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {video.created_at ? new Date(video.created_at).toLocaleString('id-ID') : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus video ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan -- video akan dihapus permanen dari Cloudinary dan Video Library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
