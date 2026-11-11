import React from 'react';
import { NavIcon } from '../../../components/ui/NavIcons';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { Icon } from '../../../components/ui/AppIcons';

export function JarsListToolbar({ jars, setCurrentPage, setSortBy, setViewMode, sortBy, viewMode }) {
  return (
    <div className="jars-toolbar-row">
      <div className="jars-toolbar-left">
        <h2 className="jars-section-title jars-section-title--box">
          <NavIcon name="jarList" size={20} />
          <span>Các hũ của bạn</span>
        </h2>
        <span className="jars-count-badge">({jars.length})</span>
      </div>
    
      <div className="jars-toolbar-right">
        {/* Sort Dropdown */}
        <CustomSelect
          prefixLabel="Sắp xếp:"
          options={[
            { value: 'newest', label: 'Mới nhất' },
            { value: 'oldest', label: 'Cũ nhất' },
            { value: 'progress_desc', label: 'Tiến độ cao nhất' },
            { value: 'deadline_asc', label: 'Đến hạn sớm nhất' },
            { value: 'name_asc', label: 'Tên A-Z' },
          ]}
          value={sortBy}
          onChange={(val) => {
            setSortBy(val);
            setCurrentPage(1);
          }}
          size="sm"
          variant="subtle"
          align="right"
          ariaLabel="Sắp xếp danh sách hũ"
        />
    
        {/* View Mode Grid/List */}
        <div className="jars-view-toggle">
          <button
            type="button"
            className={`jars-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Chế độ lưới"
            title="Chế độ xem lưới"
          >
            <Icon name="layoutGrid" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" />
          </button>
          <button
            type="button"
            className={`jars-view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label="Chế độ danh sách"
            title="Chế độ xem danh sách"
          >
            <Icon name="list" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" />
          </button>
        </div>
      </div>
    </div>
  );
}
