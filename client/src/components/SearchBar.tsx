import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getSearchKeywords } from '@/lib/searchKeywords';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Called on Enter or the search button -- submits to /cari?q=. */
  onSubmit?: (value: string) => void;
  /** Called with the input's focus state (for the recent-searches dropdown). */
  onFocusChange?: (focused: boolean) => void;
  placeholder?: string;
  className?: string;
  category?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChange,
  onSubmit,
  onFocusChange,
  placeholder,
  className = '',
  category
}) => {
  const placeholders = getSearchKeywords(category);

  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Category switch means `placeholders` is a different array -- restart
  // from its first keyword instead of carrying over an index that may be
  // out of range (or just showing an unrelated leftover keyword mid-rotation).
  useEffect(() => {
    setCurrentPlaceholder(0);
  }, [category]);

  useEffect(() => {
    if (isPaused) return;

    let fadeTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setIsVisible(false);
      fadeTimeout = setTimeout(() => {
        setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
        setIsVisible(true);
      }, 300);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimeout);
    };
  }, [placeholders.length, isPaused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    const hasValue = newValue.length > 0;
    setIsPaused(hasValue);
    setIsVisible(!hasValue);
  };

  const handleFocus = () => {
    onFocusChange?.(true);
    if (inputRef.current && inputRef.current.value.length === 0) {
      setIsVisible(false);
      setIsPaused(true);
    }
  };

  const handleBlur = () => {
    onFocusChange?.(false);
    if (inputRef.current && inputRef.current.value.length === 0) {
      setIsVisible(true);
      setIsPaused(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value) {
              e.preventDefault();
              onSubmit?.(value);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 bg-background rounded-xl border-2 border-emerald focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald transition-all"
          aria-label="Search products"
        />
        <button
          type="button"
          aria-label="Cari"
          onClick={() => value && onSubmit?.(value)}
          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-emerald transition-colors"
        >
          <Search className="h-5 w-5" />
        </button>
        {!value && (
          <div
            className={`absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none transition-opacity duration-300 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {placeholders[currentPlaceholder % placeholders.length]}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;