/** App-wide light/dark theme: stored choice, else the OS preference. */
import { readonly, ref } from 'vue';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'eval-lab-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // storage blocked (private mode)
  }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Module-level: shared by every component. */
const theme = ref<Theme>(readStored() ?? systemTheme());

function setTheme(next: Theme): void {
  theme.value = next;
  document.documentElement.classList.toggle('dark', next === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // not persisted; applied for this session only
  }
}

export function useTheme() {
  return {
    theme: readonly(theme),
    setTheme,
    toggleTheme: () => setTheme(theme.value === 'dark' ? 'light' : 'dark'),
  };
}
