import { useMemo } from 'react';
import { collectJarEvents, compareWithPreviousMonth, monthOf, monthTotals, summariseDays } from '../jarActivity';
import { buildJarSuggestions, getJarSuggestionCopy } from '../jarSuggestionCopy';
import { formatCurrency } from '../../../utils/formatters';

export const JARS_PER_PAGE = 12;

export function useJarsOverview({ currentPage, jars, lang, recomIndex, sortBy, today }) {
  const { totalSaved, totalTarget, totalPercent, totalRemaining, activeJarsCount } = useMemo(() => {
    let saved = 0;
    let target = 0;
    let activeCount = 0;

    jars.forEach((jar) => {
      const cur = Number(jar.current) || 0;
      const tgt = Number(jar.target) || 0;
      saved += cur;
      target += tgt;
      if (cur > 0 || tgt > 0) {
        activeCount++;
      }
    });

    const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const remaining = Math.max(0, target - saved);

    return {
      totalSaved: saved,
      totalTarget: target,
      totalPercent: percent,
      totalRemaining: remaining,
      activeJarsCount: activeCount
    };
  }, [jars]);

  const totalCurrent = totalSaved;

  // ── 2. Real jar activity (deposits and withdrawals by day) ──
  const jarEvents = useMemo(() => collectJarEvents(jars), [jars]);
  const jarDays = useMemo(() => summariseDays(jarEvents), [jarEvents]);
  const thisMonth = monthOf(today);
  const thisMonthNet = useMemo(() => monthTotals(jarDays, thisMonth).net, [jarDays, thisMonth]);
  const thisMonthComparison = useMemo(() => compareWithPreviousMonth(jarDays, thisMonth), [jarDays, thisMonth]);

  // Suggestions use exact balances; locale changes only affect their presentation.
  const smartSuggestions = useMemo(() => buildJarSuggestions(jars), [jars]);
  const currentSuggestion = smartSuggestions[recomIndex % smartSuggestions.length];
  const suggestionCopy = getJarSuggestionCopy(lang);
  const suggestionPercent = currentSuggestion.kind === 'complete' ? 100 : Math.floor(currentSuggestion.progress);
  const splitFirst = Math.floor((currentSuggestion.amount || 0) / 2);
  const splitSecond = (currentSuggestion.amount || 0) - splitFirst;
  const splitSuggestion = splitFirst > 0
    ? splitFirst === splitSecond
      ? suggestionCopy.splitEven(formatCurrency(splitFirst))
      : suggestionCopy.splitUneven(formatCurrency(splitFirst), formatCurrency(splitSecond))
    : '';

  // ── 4. Progress Overview 3 Cards Data ──
  const progressOverview = useMemo(() => {
    if (jars.length === 0) {
      return { closest: null, onTrack: [], needsAttention: [] };
    }

    // 1. Closest
    const sortedByPercent = [...jars].sort((a, b) => {
      const pA = Number(a.current || 0) / Number(a.target || 1);
      const pB = Number(b.current || 0) / Number(b.target || 1);
      return pB - pA;
    });
    const closest = sortedByPercent[0] || null;

    // 2. Needs Attention & 3. On Track
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const needsAttention = [];
    const onTrack = [];

    jars.forEach((j) => {
      const cur = Number(j.current) || 0;
      const tgt = Number(j.target) || 1;
      const pct = cur / tgt;

      if (cur === 0 && tgt > 0) {
        needsAttention.push({
          jar: j,
          reason: 'Chưa có số dư khởi động',
          missing: tgt
        });
      } else if (j.targetDate) {
        const targetD = new Date(j.targetDate);
        targetD.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((targetD.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (targetD < today && cur < tgt) {
          needsAttention.push({
            jar: j,
            reason: 'Đã quá hạn mục tiêu',
            missing: Math.max(0, tgt - cur)
          });
        } else if (diffDays <= 45 && pct < 0.4) {
          needsAttention.push({
            jar: j,
            reason: `Còn ${diffDays} ngày (${Math.round(pct * 100)}%)`,
            missing: Math.max(0, tgt - cur)
          });
        } else {
          onTrack.push(j);
        }
      } else if (cur > 0) {
        onTrack.push(j);
      }
    });

    return { closest, onTrack, needsAttention };
  }, [jars]);

  // ── 5. Sorted Jars for List Section ──
  const sortedJars = useMemo(() => {
    const list = [...jars];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'progress_desc':
        return list.sort((a, b) => {
          const pA = Number(a.current || 0) / Number(a.target || 1);
          const pB = Number(b.current || 0) / Number(b.target || 1);
          return pB - pA;
        });
      case 'deadline_asc':
        return list.sort((a, b) => {
          if (a.targetDate && b.targetDate) return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
          if (a.targetDate) return -1;
          if (b.targetDate) return 1;
          return 0;
        });
      case 'name_asc':
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return list;
    }
  }, [jars, sortBy]);
  const pageCount = Math.max(1, Math.ceil(sortedJars.length / JARS_PER_PAGE));
  const visibleJars = useMemo(() => {
    const start = (currentPage - 1) * JARS_PER_PAGE;
    return sortedJars.slice(start, start + JARS_PER_PAGE);
  }, [currentPage, sortedJars]);
  return { activeJarsCount, currentSuggestion, jarDays, jarEvents, pageCount, progressOverview, smartSuggestions, splitSuggestion, suggestionCopy, suggestionPercent, thisMonthComparison, thisMonthNet, totalCurrent, totalPercent, totalRemaining, totalTarget, visibleJars };
}
