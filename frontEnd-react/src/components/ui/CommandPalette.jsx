import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useTranslation } from '../../i18n/useTranslation';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { THEME_OPTIONS } from '../../utils/themes';
import { formatInputNumber, formatMonthYear, getLocalMonthString } from '../../utils/formatters';
import { shiftMonth } from '../../utils/budgetPeriod';
import { Icon } from './AppIcons';
import { NavIcon } from './NavIcons';
import { filterCommands, moveIndex, normalizeSearch, parseRecordIntent } from './commandPaletteFilter';
import './commandPaletteTranslations';
import './command-palette.css';

// Every page, in sidebar order: [view, subTab, title key, group key, icon].
const PAGES = [
  ['home', null, 'nav.home', null, 'home'],
  ['plan', 'overview', 'nav.overview', 'nav.plan', 'planOverview'],
  ['plan', 'wallets', 'nav.wallets', 'nav.plan', 'wallets'],
  ['plan', 'budgets', 'nav.budgets', 'nav.plan', 'budgets'],
  ['plan', 'recurring', 'nav.recurring', 'nav.plan', 'recurring'],
  ['analytics', 'overview', 'nav.analyticsOverview', 'nav.analytics', 'analyticsOverview'],
  ['analytics', 'spending', 'nav.spending', 'nav.analytics', 'spending'],
  ['analytics', 'cash-flow', 'nav.cashFlow', 'nav.analytics', 'cashFlow'],
  ['analytics', 'reports', 'nav.reports', 'nav.analytics', 'reports'],
  ['analytics', 'transactions', 'nav.transactionHistory', 'nav.analytics', 'transactions'],
  ['jars', 'goals', 'nav.goals', 'nav.jars', 'goals'],
  ['jars', 'jars', 'nav.jarList', 'nav.jars', 'jarList'],
  ['jars', 'history', 'nav.history', 'nav.jars', 'jarHistory'],
];
const MAX_CATEGORY_RESULTS = 3;
const HISTORY_PATH = '/spending/analytics/transactions';

const glyph = (name) => (
  <Icon name={name} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
);

/**
 * Ctrl/Cmd + K command palette (NAV-12, desktop only). Loaded on demand by
 * CommandPaletteHost; a combobox over a grouped listbox, run with ↑ ↓ Enter.
 */
export function CommandPalette({ onClose }) {
  const { t, label } = useTranslation();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const view = useSpendingStore((s) => s.activeView);
  const planSubTab = useSpendingStore((s) => s.planSubTab);
  const analyticsSubTab = useSpendingStore((s) => s.analyticsSubTab);
  const jarsSubTab = useSpendingStore((s) => s.jarsSubTab);
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const storeCategories = useTransactionStore((s) => s.categories);
  const transactions = useTransactionStore((s) => s.transactions);
  const jars = useJarStore((s) => s.jars);
  const theme = useThemeStore((s) => s.theme);

  useFocusTrap(panelRef, true, { onEscape: onClose, initialFocusRef: inputRef });
  useBodyScrollLock(true);

  const categoryNames = useMemo(() => [...new Set([
    ...(storeCategories || []).map((category) => category.name),
    ...(transactions || []).map((txn) => txn.category),
  ].filter(Boolean))], [storeCategories, transactions]);

  const groups = useMemo(() => {
    const spending = useSpendingStore.getState();
    const request = (target, subTab, action, payload) => () => {
      spending.navigateTo(target, subTab);
      if (action) spending.requestCommand(action, payload);
    };
    const subTabOf = { plan: planSubTab, analytics: analyticsSubTab, jars: jarsSubTab };
    const commands = [];
    const add = (command) => commands.push(command);

    // Ghi chép
    const intent = parseRecordIntent(query);
    if (intent && (intent.desc || intent.amount)) {
      const income = intent.type === 'income';
      add({
        id: 'record-typed', group: 'record', icon: glyph('plus'), pinned: true,
        label: intent.desc ? t(income ? 'cmdk.addIncomeWith' : 'cmdk.addExpenseWith', { desc: intent.desc })
          : t(income ? 'cmdk.addIncome' : 'cmdk.addExpense'),
        detail: intent.amount ? formatInputNumber(intent.amount) : '',
        run: () => spending.openAddTxnModal({ type: intent.type, desc: intent.desc, amount: intent.amount || undefined }),
      });
    }
    add({ id: 'add-expense', group: 'record', icon: glyph('plus'), hint: ['N'], label: t('cmdk.addExpense'),
      keywords: [t('cmdk.keywords.record'), t('cmdk.keywords.expense')],
      run: () => spending.openAddTxnModal({ type: 'expense' }) });
    add({ id: 'add-income', group: 'record', icon: glyph('plus'), label: t('cmdk.addIncome'),
      keywords: [t('cmdk.keywords.record'), t('cmdk.keywords.income')],
      run: () => spending.openAddTxnModal({ type: 'income' }) });
    add({ id: 'transfer', group: 'record', icon: glyph('swapHorizontal'), label: t('cmdk.transfer'),
      keywords: [t('cmdk.keywords.transfer')], run: request('plan', 'wallets', 'transfer') });
    const depositKeywords = [t('cmdk.deposit'), t('cmdk.keywords.deposit')];
    if (jars.length === 1) {
      add({ id: 'deposit', group: 'record', icon: glyph('jarGoal'), label: t('cmdk.depositInto', { name: jars[0].name }),
        keywords: depositKeywords, run: request('jars', 'jars', 'jar-deposit', { jarId: jars[0].id }) });
    } else {
      // No jar yet: open the jar list, where "Tạo hũ" is. Several: typing narrows to one row per jar.
      add({ id: 'deposit', group: 'record', icon: glyph('jarGoal'), label: t('cmdk.deposit'), keywords: depositKeywords,
        emptyOnly: jars.length > 1,
        run: jars.length > 1 ? () => { setQuery(`${t('cmdk.deposit')} `); return true; } : request('jars', 'jars') });
      if (jars.length > 1) {
        jars.forEach((jar) => add({ id: `deposit-${jar.id}`, group: 'record', icon: glyph('jarGoal'), queryOnly: true,
          label: t('cmdk.depositInto', { name: jar.name }), keywords: depositKeywords,
          run: request('jars', 'jars', 'jar-deposit', { jarId: jar.id }) }));
      }
    }

    // Tìm: the typed words, or what follows "chi"/"thu".
    const term = (intent ? intent.desc : query).trim();
    const needle = normalizeSearch(term);
    if (needle.length >= 2) {
      const openHistory = (commandSearch) => () => navigate(HISTORY_PATH, { state: { commandSearch } });
      add({ id: 'search-text', group: 'search', icon: glyph('searchSmall'), pinned: true, score: 0.5,
        label: t('cmdk.searchText', { query: term }), run: openHistory({ query: term }) });
      categoryNames
        .filter((name) => normalizeSearch(`${name} ${label(name)}`).includes(needle))
        .slice(0, MAX_CATEGORY_RESULTS)
        .forEach((name) => add({ id: `search-category-${name}`, group: 'search', icon: glyph('tag'), pinned: true, score: 2,
          label: t('cmdk.searchCategory', { name: label(name) }), run: openHistory({ category: name }) }));
    }

    // Đi tới
    PAGES.forEach(([target, subTab, titleKey, groupKey, icon]) => {
      const current = view === target && (!subTab || subTabOf[target] === subTab);
      add({ id: `goto-${target}-${subTab || 'home'}`, group: 'goto', icon: <NavIcon name={icon} size={16} />,
        label: t(titleKey), detail: current ? t('cmdk.current') : groupKey ? t(groupKey) : '',
        keywords: groupKey ? [t(groupKey)] : [], run: request(target, subTab) });
    });

    // Kỳ: only where the page follows the shared month (Phân tích, Ngân sách, Khoản định kỳ).
    const followsMonth = (view === 'analytics' && analyticsSubTab !== 'transactions')
      || (view === 'plan' && (planSubTab === 'budgets' || planSubTab === 'recurring'));
    if (followsMonth && selectedMonth) {
      [['prev', -1, 'chevronLeft'], ['next', 1, 'chevronRight']].forEach(([key, delta, icon]) => {
        const month = shiftMonth(selectedMonth, delta);
        add({ id: `period-${key}`, group: 'period', icon: glyph(icon), label: t(`cmdk.${key}Month`),
          detail: formatMonthYear(`${month}-01`), keywords: [t('cmdk.keywords.period')],
          run: () => spending.setSelectedMonth(month) });
      });
    }

    // Khác
    add({ id: 'edit-budgets', group: 'other', icon: glyph('pencil'), label: t('cmdk.editBudgets'),
      keywords: [t('cmdk.keywords.budgets')],
      run: () => {
        // A past month's limits are read-only; editing means this month's.
        const thisMonth = getLocalMonthString();
        if (selectedMonth < thisMonth) spending.setSelectedMonth(thisMonth);
        request('plan', 'budgets', 'edit-budgets')();
      } });
    add({ id: 'export-csv', group: 'other', icon: glyph('download'), label: t('cmdk.exportCsv'),
      keywords: [t('cmdk.keywords.export')], run: request('analytics', 'reports', 'export-csv') });
    add({ id: 'theme', group: 'other', icon: glyph('sparkle'), label: t('cmdk.changeTheme'), emptyOnly: true,
      keywords: [t('cmdk.keywords.theme')], run: () => { setQuery(`${t('cmdk.changeTheme')} `); return true; } });
    THEME_OPTIONS.forEach((option) => add({ id: `theme-${option.id}`, group: 'other', icon: glyph('sparkle'), queryOnly: true,
      label: t('cmdk.themeOption', { name: t(option.labelKey) }), detail: option.id === theme ? t('cmdk.current') : '',
      keywords: [t('cmdk.changeTheme'), t('cmdk.keywords.theme')],
      run: () => useThemeStore.getState().setTheme(option.id) }));
    add({ id: 'settings', group: 'other', icon: glyph('settingsGear'), label: t('cmdk.openSettings'),
      keywords: [t('cmdk.keywords.settings')], run: () => spending.openSettingsModal() });
    add({ id: 'help', group: 'other', icon: glyph('info'), label: t('cmdk.openHelp'),
      keywords: [t('cmdk.keywords.help')], run: () => spending.openHelpModal() });

    return filterCommands(commands, query);
  }, [query, t, label, navigate, view, planSubTab, analyticsSubTab, jarsSubTab, selectedMonth, categoryNames, jars, theme]);

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const active = items[Math.min(activeIndex, items.length - 1)];
  const optionId = (command) => `cmdk-option-${command.id.replace(/[^\w-]/g, '_')}`;

  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => {
    if (active) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (command) => {
    if (!command) return;
    if (command.run() === true) {
      inputRef.current?.focus();
      return;
    }
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => moveIndex(Math.min(index, items.length - 1), event.key === 'ArrowDown' ? 1 : -1, items.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(active);
    }
  };

  let position = -1;
  return createPortal(
    <div className="cmdk-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} className="cmdk-panel" role="dialog" aria-modal="true" aria-label={t('cmdk.label')} tabIndex={-1}>
        <div className="cmdk-search">
          <Icon name="searchSmall" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active) : undefined}
            aria-label={t('cmdk.label')}
            placeholder={t('cmdk.placeholder')}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>

        <div className="cmdk-list" id="cmdk-listbox" role="listbox" aria-label={t('cmdk.results')}>
          {groups.map(({ group, items: groupItems }) => (
            <div key={group} className="cmdk-group" role="group" aria-labelledby={`cmdk-group-${group}`}>
              <div className="cmdk-group-title" id={`cmdk-group-${group}`} role="presentation">{t(`cmdk.group.${group}`)}</div>
              {groupItems.map((command) => {
                position += 1;
                const index = position;
                const selected = command === active;
                return (
                  <div
                    key={command.id}
                    id={optionId(command)}
                    className={`cmdk-option${selected ? ' is-active' : ''}`}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => { if (activeIndex !== index) setActiveIndex(index); }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => run(command)}
                  >
                    <span className="cmdk-option-icon" aria-hidden="true">{command.icon}</span>
                    <span className="cmdk-option-label">{command.label}</span>
                    {command.detail && <span className="cmdk-option-detail">{command.detail}</span>}
                    {command.hint?.map((key) => <kbd key={key} className="cmdk-kbd" aria-hidden="true">{key}</kbd>)}
                    {selected && <kbd className="cmdk-kbd cmdk-kbd--enter" aria-hidden="true">↵</kbd>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="cmdk-empty" role="status">
            <p>{t('cmdk.empty', { query: query.trim() })}</p>
            <p className="cmdk-empty-hint">{t('cmdk.emptyHint')}</p>
          </div>
        )}

        <div className="cmdk-footer" aria-hidden="true">
          <span><kbd className="cmdk-kbd">↑</kbd><kbd className="cmdk-kbd">↓</kbd>{t('cmdk.footerMove')}</span>
          <span><kbd className="cmdk-kbd">↵</kbd>{t('cmdk.footerRun')}</span>
          <span><kbd className="cmdk-kbd">Esc</kbd>{t('cmdk.footerClose')}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
