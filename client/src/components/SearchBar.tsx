import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onChange,
  placeholder,
  className = ''
}) => {
  const placeholders = [
    "skincare",
    "fashion wanita",
    "elektronik & gadget",
    "perlengkapan rumah tangga",
    "aksesoris HP",
    "smartwatch",
    "springbed",
    "meja gaming",
    "kursi gaming",
    "powerbank"
  ];

  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
        setIsVisible(true);
      }, 300);
    }, 2000);

    return () => clearInterval(interval);
  }, [placeholders.length, isPaused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    const hasValue = newValue.length > 0;
    setIsPaused(hasValue);
    setIsVisible(!hasValue);
  };

  const handleFocus = () => {
    if (inputRef.current && inputRef.current.value.length === 0) {
      setIsVisible(false);
      setIsPaused(true);
    }
  };

  const handleBlur = () => {
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
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 bg-background rounded-xl border-2 border-emerald focus:outline-none focus:ring-2 focus:ring-emerald focus:border-emerald transition-all"
          aria-label="Search products"
        />
        <button
          type="button"
          aria-label="Cari"
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
            {placeholders[currentPlaceholder]}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchBar;