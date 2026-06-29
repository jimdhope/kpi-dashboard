'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, Plus, Loader2 } from 'lucide-react';

interface ComboboxOption {
  id: string;
  name: string;
  color?: string;
}

interface CreatableComboboxProps {
  options: ComboboxOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  createLabel?: string;
  onCreateOption?: (name: string) => Promise<string>;
  disabled?: boolean;
}

export function CreatableCombobox({
  options,
  selectedIds,
  onChange,
  placeholder = 'Search or create...',
  createLabel = 'Create new',
  onCreateOption,
  disabled = false,
}: CreatableComboboxProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!inputValue.trim() || !onCreateOption) return;
    
    const existing = options.find(
      o => o.name.toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (existing) {
      if (!selectedIds.includes(existing.id)) {
        onChange([...selectedIds, existing.id]);
      }
      setInputValue('');
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const newId = await onCreateOption(inputValue.trim());
      onChange([...selectedIds, newId]);
      setInputValue('');
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create option:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map(id => {
              const opt = options.find(o => o.id === id);
              if (!opt) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  disabled={disabled}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all',
                    !disabled && 'hover:opacity-80',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                  style={{
                    backgroundColor: opt.color ? `${opt.color}20` : undefined,
                    borderColor: opt.color,
                    color: opt.color,
                  }}
                >
                  {opt.name}
                  {!disabled && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}
        
        <input
          type="text"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedIds.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] border-0 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      {isOpen && inputValue && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.color || '#6366f1' }}
                />
                {opt.name}
                {selectedIds.includes(opt.id) && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))
          ) : null}
          
          {inputValue.trim() && onCreateOption && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-primary"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {createLabel}: "{inputValue.trim()}"
            </button>
          )}
          
          {filteredOptions.length === 0 && !inputValue.trim() && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {options.length === 0 ? 'No options yet' : 'No matches found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CategoryComboboxProps {
  categories: { id: string; name: string }[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: string;
  onCreateCategory?: (name: string) => Promise<string>;
  disabled?: boolean;
}

export function CategoryCombobox({
  categories,
  selectedId,
  onChange,
  placeholder = 'Select or create category...',
  onCreateCategory,
  disabled = false,
}: CategoryComboboxProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setInputValue('');
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!inputValue.trim() || !onCreateCategory) return;
    
    const existing = categories.find(
      c => c.name.toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (existing) {
      onChange(existing.id);
      setInputValue('');
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const newId = await onCreateCategory(inputValue.trim());
      onChange(newId);
      setInputValue('');
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategory = categories.find(c => c.id === selectedId);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={selectedId ? selectedCategory?.name || '' : inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          onChange('');
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
      />

      {isOpen && inputValue && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {filteredCategories.length > 0 && (
            <>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
          
          {inputValue.trim() && onCreateCategory && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-primary"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create: "{inputValue.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}