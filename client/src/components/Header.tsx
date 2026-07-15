import { useState } from 'react';
import Link from 'next/link';
import { Search, Menu, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/useTheme';
import SearchBar from '@/components/SearchBar';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuToggle: () => void;
}

export function Header({ searchQuery, onSearchChange, onMenuToggle }: HeaderProps) {
  const { theme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3" data-testid="link-home">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald to-metallic rounded-xl flex items-center justify-center">
              <i className="fas fa-store text-white text-lg"></i>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald to-metallic bg-clip-text text-transparent">
              SEMUADA
            </h1>
          </Link>
          
          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
            />
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuToggle}
              className="md:hidden p-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
          </div>
        </div>
        
        {/* Mobile Search */}
        <div className="md:hidden mt-4">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
          />
        </div>
      </div>
    </header>
  );
}
