import React from 'react';
import { translations } from '../../i18n/translations';
import { CategoryOutlineIcon } from './AppIcons';

// Built-in categories (stored by their English key, or by an older Vietnamese/English label).
let builtIn = null;
const isBuiltInCategory = (name) => {
  if (!builtIn) {
    builtIn = new Set(['transfer']);
    for (const dict of Object.values(translations)) {
      for (const [key, value] of Object.entries(dict)) {
        if (!key.startsWith('category.')) continue;
        builtIn.add(key.slice(9).toLowerCase());
        builtIn.add(String(value).toLowerCase());
      }
    }
  }
  return builtIn.has(String(name || '').trim().toLowerCase());
};

/**
 * Category icon. Built-in categories keep their drawn icon; a category the person created
 * shows its first letter instead of borrowing a look-alike icon ("Cà phê" next to "Ăn uống").
 */
export function CategoryMark({ name, size = 16 }) {
  const text = String(name || '').trim();
  if (!text || isBuiltInCategory(text)) return <CategoryOutlineIcon name={text} size={size} />;
  const initial = Array.from(text)[0].toLocaleUpperCase('vi');
  return (
    <span className="category-mark-letter" style={{ '--category-mark-size': `${size}px` }} aria-hidden="true">
      {initial}
    </span>
  );
}
