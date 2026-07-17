import { useRef, useState } from 'react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCharacters, useAddCharacter, useDeleteCharacter } from "@/hooks/useContentGenerator";
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

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setPendingFile(file);
    setPendingName(file.name);
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
              onClick={() => deleteCharacter.mutate(character.id)}
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
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={addCharacter.isPending}>
            {pendingFile ? 'Ganti Foto' : 'Pilih Foto'}
          </Button>
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
    </div>
  );
}
