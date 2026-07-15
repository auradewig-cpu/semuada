import type { Product } from "@/types";

interface ImagePickerProps {
  product: Product;
  selectedImageUrls: string[];
  onChange: (urls: string[]) => void;
}

export function ImagePicker({ product, selectedImageUrls, onChange }: ImagePickerProps) {
  const allImages = [product.image_url, ...(product.image_urls || [])].filter((url): url is string => Boolean(url));

  const toggle = (url: string) => {
    if (selectedImageUrls.includes(url)) {
      onChange(selectedImageUrls.filter((u) => u !== url));
    } else {
      onChange([...selectedImageUrls, url]);
    }
  };

  if (allImages.length === 0) {
    return <p className="text-sm text-muted-foreground">Produk ini belum punya foto.</p>;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">
        Klik foto untuk memilih — urutan klik menentukan nomor scene.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {allImages.map((url) => {
          const sceneIndex = selectedImageUrls.indexOf(url);
          const isSelected = sceneIndex !== -1;
          return (
            <button
              type="button"
              key={url}
              onClick={() => toggle(url)}
              className={`relative rounded-lg overflow-hidden border-2 aspect-square ${
                isSelected ? 'border-primary' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {isSelected && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                  {sceneIndex + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
