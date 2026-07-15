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

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!pendingName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Isi nama karakter dulu." });
      return;
    }
    addCharacter.mutate(
      { name: pendingName.trim(), photo: file },
      {
        onSuccess: () => {
          toast({ title: "Tersimpan", description: "Karakter berhasil diupload." });
          setPendingName('');
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${
            characterId === null ? 'border-primary' : 'border-transparent'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <UserRound className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-xs">Faceless</span>
        </button>

        {!isLoading && data?.items.map((character) => (
          <div key={character.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(character.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 ${
                characterId === character.id ? 'border-primary' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={character.photoUrl} alt={character.name} className="w-14 h-14 rounded-full object-cover" />
              <span className="text-xs max-w-[4rem] truncate">{character.name}</span>
            </button>
            <button
              type="button"
              onClick={() => deleteCharacter.mutate(character.id)}
              className="absolute -top-1 -right-1 hidden group-hover:flex bg-destructive text-destructive-foreground rounded-full w-5 h-5 items-center justify-center"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowUploadForm((v) => !v)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 border-dashed border-muted-foreground/30"
        >
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-xs">Tambah</span>
        </button>
      </div>

      {showUploadForm && (
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Nama karakter"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            className="max-w-xs"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={addCharacter.isPending}>
            {addCharacter.isPending ? 'Mengupload...' : 'Pilih Foto'}
          </Button>
        </div>
      )}
    </div>
  );
}
