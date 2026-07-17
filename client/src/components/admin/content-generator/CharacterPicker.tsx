import { useRef, useState } from 'react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useCharacters, useAddCharacter, useDeleteCharacter, type Character } from "@/hooks/useContentGenerator";
import { useToast } from "@/hooks/use-toast";

interface CharacterPickerProps {
  characterId: string | null;
  onSelect: (id: string | null) => void;
}

export function CharacterPicker({ characterId, onSelect }: CharacterPickerProps) {
  const { data, isLoading } = useCharacters();
  const addCharacter = useAddCharacter();
  const deleteCharacter = useDeleteCharacter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingName, setPendingName] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCharacter.mutate(deleteTarget.id, {
      onSuccess: () => {
        // The deleted character may still be the one selected upstream --
        // reset it, otherwise generate silently falls back to faceless
        // without telling the user their selection just vanished.
        if (characterId === deleteTarget.id) onSelect(null);
        toast({ title: "Dihapus", description: `Karakter "${deleteTarget.name}" dihapus.` });
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Gagal menghapus", description: error.message });
      },
    });
  };

  const handleFileSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Single file: keep the review step so the auto-filled name can still
    // be edited before upload. Multiple files: skip review entirely (that'd
    // mean reviewing dozens one-by-one) and upload each with its filename
    // as name, sequentially -- matches how single-file naming already works.
    if (files.length === 1) {
      setPendingFile(files[0]);
      setPendingName(files[0].name);
      return;
    }

    void uploadManyFiles(Array.from(files));
  };

  const uploadManyFiles = async (files: File[]) => {
    setBulkProgress({ done: 0, total: files.length });
    let succeeded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        await addCharacter.mutateAsync({ name: file.name, photo: file });
        succeeded++;
      } catch {
        failed++;
      }
      setBulkProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }

    setBulkProgress(null);
    toast({
      variant: failed > 0 ? "destructive" : "default",
      title: failed > 0 ? `Selesai dengan ${failed} gagal` : "Semua berhasil diupload",
      description: `${succeeded} dari ${files.length} karakter berhasil diupload.`,
    });
  };

  const handleConfirmUpload = () => {
    if (!pendingFile) return;
    if (!pendingName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Nama karakter tidak boleh kosong." });
      return;
    }
    addCharacter.mutate(
      { name: pendingName.trim(), photo: pendingFile },
      {
        onSuccess: () => {
          toast({ title: "Tersimpan", description: "Karakter berhasil diupload." });
          setPendingName('');
          setPendingFile(null);
          setShowUploadForm(false);
        },
        onError: (error) => {
          toast({ variant: "destructive", title: "Error", description: error.message });
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto p-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex flex-col rounded-lg border-2 overflow-hidden ${
            characterId === null ? 'border-primary' : 'border-border'
          }`}
        >
          <div className="w-full aspect-square bg-muted flex items-center justify-center">
            <UserRound className="h-8 w-8 text-muted-foreground" />
          </div>
          <span className="text-xs py-1 text-center truncate px-1">Faceless</span>
        </button>

        {!isLoading && data?.items.map((character) => (
          <div key={character.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(character.id)}
              className={`flex flex-col rounded-lg border-2 overflow-hidden w-full ${
                characterId === character.id ? 'border-primary' : 'border-border'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.photoUrl} alt={character.name} className="w-full aspect-square object-cover" />
              <span className="text-xs py-1 text-center truncate px-1 w-full">{character.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(character)}
              className="absolute top-1 right-1 hidden group-hover:flex bg-destructive text-destructive-foreground rounded-full w-5 h-5 items-center justify-center"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowUploadForm((v) => !v)}
          className="flex flex-col rounded-lg border-2 border-dashed border-muted-foreground/30 overflow-hidden"
        >
          <div className="w-full aspect-square bg-muted flex items-center justify-center">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <span className="text-xs py-1 text-center truncate px-1">Tambah</span>
        </button>
      </div>

      {showUploadForm && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={addCharacter.isPending || bulkProgress !== null}>
            {pendingFile ? 'Ganti Foto' : 'Pilih Foto (bisa lebih dari 1)'}
          </Button>
          {bulkProgress && (
            <span className="text-xs text-muted-foreground">
              Mengupload {bulkProgress.done}/{bulkProgress.total}...
            </span>
          )}
          {pendingFile && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(pendingFile)} alt="" className="w-10 h-10 rounded object-cover" />
              <Input
                placeholder="Nama karakter"
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="button" onClick={handleConfirmUpload} disabled={addCharacter.isPending}>
                {addCharacter.isPending ? 'Mengupload...' : 'Upload'}
              </Button>
            </>
          )}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus karakter "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Kalau karakter ini sedang dipakai di scene manapun, generate berikutnya akan otomatis jadi faceless.
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
