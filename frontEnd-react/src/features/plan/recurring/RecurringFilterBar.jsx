import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { SORT_OPTIONS } from './recurringOptions';

export function RecurringFilterBar({ counts, currentSortLabel, filterTab, isSortDropdownOpen, setFilterTab, setIsSortDropdownOpen, setSortBy, sortBy, sortRef }) {
  return (
    <div className="recurring-controls-bar">
      <div className="recurring-filter-pills" role="tablist" aria-label="Lọc khoản định kỳ">
        <button
          type="button"
          className={`filter-pill-btn ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
          role="tab"
          aria-selected={filterTab === 'all'}
        >
          <span>Tất cả</span>
          <span className="pill-count-tag">{counts.all}</span>
        </button>
    
        <button
          type="button"
          className={`filter-pill-btn ${filterTab === 'soon' ? 'active' : ''}`}
          onClick={() => setFilterTab('soon')}
          role="tab"
          aria-selected={filterTab === 'soon'}
        >
          <span>Sắp đến hạn</span>
          <span className="pill-count-tag">{counts.soon}</span>
        </button>
    
        <button
          type="button"
          className={`filter-pill-btn ${filterTab === 'today' ? 'active' : ''}`}
          onClick={() => setFilterTab('today')}
          role="tab"
          aria-selected={filterTab === 'today'}
        >
          <span>Hôm nay</span>
          <span className="pill-count-tag">{counts.today}</span>
        </button>
    
        <button
          type="button"
          className={`filter-pill-btn ${filterTab === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilterTab('overdue')}
          role="tab"
          aria-selected={filterTab === 'overdue'}
        >
          <span>Quá hạn</span>
          <span className="pill-count-tag">{counts.overdue}</span>
        </button>
      </div>
    
      {/* Custom Themed Sort Dropdown */}
      <div className="recurring-sort-custom-wrap" ref={sortRef}>
        <button
          type="button"
          className={`recurring-sort-custom-btn ${isSortDropdownOpen ? 'is-active' : ''}`}
          onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
          aria-expanded={isSortDropdownOpen}
          aria-haspopup="listbox"
          aria-label={`Sắp xếp: ${currentSortLabel}`}
        >
          <Icon name="sortArrows" className="sort-compact-icon" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <span className="sort-label-text">{currentSortLabel}</span>
          <Icon name="chevronDown" className={`sort-chevron-icon ${isSortDropdownOpen ? 'is-open' : ''}`} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </button>
    
        {isSortDropdownOpen && (
          <div className="recurring-sort-custom-menu" role="listbox">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`sort-custom-item ${sortBy === opt.value ? 'is-selected' : ''}`}
                onClick={() => {
                  setSortBy(opt.value);
                  setIsSortDropdownOpen(false);
                }}
                role="option"
                aria-selected={sortBy === opt.value}
              >
                {sortBy === opt.value && (
                  <Icon name="check" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
