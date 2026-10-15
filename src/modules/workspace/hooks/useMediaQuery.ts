import { useEffect, useState } from 'react';

/** true enquanto a media query corresponder (ex.: '(min-width: 1024px)'). */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
};
