import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { pickPdfFile } from '@/presentation/hooks/pickPdfFile';

type OnDropPdf = (uri: string, fileName: string) => void;

export function useFileDrop(onDropPdf: OnDropPdf): boolean {
  const [dragging, setDragging] = useState(false);
  const handler = useRef(onDropPdf);

  useEffect(() => {
    handler.current = onDropPdf;
  }, [onDropPdf]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }
    let depth = 0;
    const carriesFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (event: DragEvent): void => {
      if (!carriesFiles(event)) {
        return;
      }
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent): void => {
      if (carriesFiles(event)) {
        event.preventDefault();
      }
    };
    const onLeave = (event: DragEvent): void => {
      if (!carriesFiles(event)) {
        return;
      }
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setDragging(false);
      }
    };
    const onDrop = (event: DragEvent): void => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = pickPdfFile(event.dataTransfer?.files ?? []);
      if (file !== null) {
        handler.current(URL.createObjectURL(file), file.name);
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return dragging;
}
