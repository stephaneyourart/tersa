'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const themes = [
  {
    label: 'Light',
    icon: SunIcon,
    value: 'light',
  },
  {
    label: 'Dark',
    icon: MoonIcon,
    value: 'dark',
  },
  {
    label: 'System',
    icon: MonitorIcon,
    value: 'system',
  },
];

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Évite l'erreur d'hydratation en n'affichant l'icône qu'après le montage
  useEffect(() => {
    setMounted(true);
  }, []);

  // Icône par défaut pendant le SSR pour éviter le mismatch
  const ThemeIcon = mounted
    ? theme === 'light'
      ? SunIcon
      : theme === 'dark'
        ? MoonIcon
        : MonitorIcon
    : MonitorIcon;

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Select theme"
            className="rounded-full"
          >
            <ThemeIcon size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-32">
          {themes.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => setTheme(theme.value)}
            >
              <theme.icon
                size={16}
                strokeWidth={2}
                className="opacity-60"
                aria-hidden="true"
              />
              <span>{theme.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
