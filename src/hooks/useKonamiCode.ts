import { useEffect, useState } from 'react';

export const useKonamiCode = (callback: () => void) => {
  const [, setSequence] = useState<string[]>([]);
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setSequence(prev => {
        const newSequence = [...prev, e.key];
        if (newSequence.length > code.length) {
          newSequence.shift();
        }
        
        if (newSequence.join('') === code.join('')) {
          callback();
          return [];
        }
        
        // Reset if mismatch to avoid partial matches later (simplistic)
        // Better: check if newSequence is a prefix of code
        const isPrefix = code.join('').startsWith(newSequence.join(''));
        if (!isPrefix && newSequence.length > 0) {
            // Logic to keep last valid char if it starts new sequence? 
            // Keep it simple: if not prefix, reset to just current char if it matches first char
            if (e.key === code[0]) return [e.key];
            return [];
        }

        return newSequence;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
};
