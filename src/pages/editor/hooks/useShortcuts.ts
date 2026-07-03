import { useEffect } from 'react';
import { useEditor } from '@/store/editorStore';

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditingTarget(e.target)) return;
      const store = useEditor.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        store.toggleGrid();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          e.preventDefault();
          store.removeElements(store.selectedIds);
        }
        return;
      }
      if (e.key === 'Escape') {
        store.clearSelection();
        return;
      }
      const nudge = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          store.nudgeSelected(-nudge, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          store.nudgeSelected(nudge, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          store.nudgeSelected(0, -nudge);
          break;
        case 'ArrowDown':
          e.preventDefault();
          store.nudgeSelected(0, nudge);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
