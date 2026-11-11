import React from 'react';
import { CloseOutlineIcon, Icon } from '../../../components/ui/AppIcons';
import { WalletFilterDropdown } from './WalletFilterDropdown';

export function WalletsFilterToolbar({ filterStatus, filterType, searchQuery, setFilterStatus, setFilterType, setSearchQuery, setViewMode, viewMode }) {
  return (
    <div className="wallets-filter-toolbar">
      <div className="wallets-filter-inputs-group">
        {/* 1. Ô tìm kiếm theo tên ví */}
        <div className="wallets-search-box">
          <Icon name="search" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <input
            type="text"
            className="wallets-search-input"
            placeholder="Tìm kiếm ví..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Tìm kiếm ví"
          />
          {searchQuery && (
            <button
              type="button"
              className="wallets-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa tìm kiếm"
            >
              <CloseOutlineIcon size={12} />
            </button>
          )}
        </div>
    
        {/* 2. Lọc theo loại ví */}
        <WalletFilterDropdown
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: 'all', label: 'Tất cả loại ví' },
            { value: 'cash', label: 'Ví tiền mặt' },
            { value: 'bank', label: 'Tài khoản ngân hàng' },
            { value: 'credit', label: 'Thẻ tín dụng' },
            { value: 'e-wallet', label: 'Ví điện tử' }
          ]}
          label="Lọc theo loại ví"
        />
    
        {/* 3. Lọc theo trạng thái */}
        <WalletFilterDropdown
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: 'Tất cả trạng thái' },
            { value: 'default', label: 'Ví mặc định' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'excluded', label: 'Không tính vào tổng' }
          ]}
          label="Lọc theo trạng thái"
        />
      </div>
    
      {/* 4. Nhóm nút chuyển chế độ hiển thị: Thẻ (Card View) & Danh sách (List View) */}
      <div className="wallets-view-toggle-bar" role="group" aria-label="Kiểu hiển thị danh sách ví">
        <button
          type="button"
          className={`view-toggle-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
          onClick={() => setViewMode('grid')}
          title="Hiển thị dạng thẻ (lưới)"
        >
          <Icon name="gridSquare" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <span>Thẻ</span>
        </button>
        <button
          type="button"
          className={`view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
          onClick={() => setViewMode('list')}
          title="Hiển thị dạng danh sách"
        >
          <Icon name="list" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <span>Danh sách</span>
        </button>
      </div>
    </div>
  );
}
