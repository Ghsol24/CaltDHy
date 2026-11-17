// Category colours for the "Chi tiêu theo danh mục" donut and its list. The hues live in
// tokens.css (--chart-cat-1…6, --chart-cat-other), one set for the light themes and one for
// the dark theme, so list dots (CSS) and slices (canvas) always match.
export const MAX_COLORED_CATEGORIES = 6;
export const OTHER_SLICE_KEY = '__other__';

export const colorVarForRank = (rank) => (rank < MAX_COLORED_CATEGORIES ? `--chart-cat-${rank + 1}` : '--chart-cat-other');

/**
 * Turns the ranked category list (largest first) into donut slices: the six largest keep their
 * own colour, anything beyond that is folded into one grey "other" slice. A single leftover
 * category is shown as itself (in grey) instead of a group of one.
 */
export function buildCategorySlices(categories) {
  const toSlice = (category, rank) => ({
    key: category.name, name: category.name, amount: category.amount, percent: category.percent,
    colorVar: colorVarForRank(rank), members: null,
  });
  if (categories.length <= MAX_COLORED_CATEGORIES + 1) return categories.map(toSlice);
  const rest = categories.slice(MAX_COLORED_CATEGORIES);
  return [
    ...categories.slice(0, MAX_COLORED_CATEGORIES).map(toSlice),
    {
      key: OTHER_SLICE_KEY, name: null, amount: rest.reduce((sum, item) => sum + item.amount, 0),
      percent: rest.reduce((sum, item) => sum + item.percent, 0), colorVar: colorVarForRank(MAX_COLORED_CATEGORIES),
      members: rest,
    },
  ];
}
