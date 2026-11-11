import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { CategoryOutlineIcon } from '../../../utils/categoryIcons';
import { useTranslation } from '../../../i18n/useTranslation';

export function RecurringIdentitySection({ catRef, category, categoryDisplayName, handleCreateNewCategory, handleNameChange, isAddingNewCategory, isCategoryDropdownOpen, name, nameInputRef, newCatInputName, newCatInputRef, setCategory, setIsAddingNewCategory, setIsCategoryDropdownOpen, setIsCycleDropdownOpen, setIsWalletDropdownOpen, setNewCatInputName, syncedExpenseCategories }) {
  const { label } = useTranslation();
  return (
    <div className="recurring-form-section">
      <div className="recurring-section-header">
        <Icon name="tag" className="section-header-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <span className="section-header-title">Định danh & Phân loại</span>
      </div>
    
      <div className="recurring-section-content">
        {/* 1. Tên khoản chi / dịch vụ */}
        <div className="txn-field-group">
          <label htmlFor="rec-name" className="txn-label">
            <span>Tên khoản chi / dịch vụ</span>
          </label>
          <input
            id="rec-name"
            ref={nameInputRef}
            type="text"
            className="txn-input modal-themed-input"
            placeholder="VD: Youtube Premium, Netflix, Tiền nhà, Internet FPT..."
            value={name}
            onChange={handleNameChange}
            maxLength={60}
            required
          />
        </div>
    
        {/* 2. Danh mục chi tiêu */}
        <div className="txn-field-group" ref={catRef}>
          <label className="txn-label">
            <span>Danh mục chi tiêu</span>
          </label>
          <div className="modal-custom-dropdown-wrap">
            <button
              type="button"
              className={`modal-custom-dropdown-btn ${isCategoryDropdownOpen ? 'is-open' : ''}`}
              onClick={() => {
                setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                setIsWalletDropdownOpen(false);
                setIsCycleDropdownOpen(false);
                setIsAddingNewCategory(false);
              }}
              aria-expanded={isCategoryDropdownOpen}
            >
              <div className="dropdown-btn-content">
                <CategoryOutlineIcon name={category} size={16} className="dropdown-outline-icon text-brand" />
                <span className="dropdown-btn-text">{categoryDisplayName}</span>
              </div>
              <Icon name="chevronDown" className="dropdown-chevron-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </button>
    
            {isCategoryDropdownOpen && (
              <div className="modal-custom-dropdown-menu" role="listbox">
                <div className="modal-dropdown-scroll-list">
                  {syncedExpenseCategories.map((c) => {
                    const isSelected = c.name.toLowerCase() === category.toLowerCase();
                    const labelDisplay = label(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setCategory(c.name);
                          setIsCategoryDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="dropdown-item-left">
                          <CategoryOutlineIcon name={c.name} size={16} className="dropdown-outline-icon" />
                          <span className="dropdown-item-label">{labelDisplay}</span>
                        </div>
                        {isSelected && (
                          <Icon name="check" className="dropdown-item-check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </button>
                    );
                  })}
                </div>
    
                {/* Nút hoặc Form tạo nhanh danh mục mới */}
                <div className="modal-dropdown-footer-action">
                  {!isAddingNewCategory ? (
                    <button
                      type="button"
                      className="dropdown-add-cat-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingNewCategory(true);
                        setTimeout(() => newCatInputRef.current?.focus(), 50);
                      }}
                    >
                      <Icon name="plus" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <span>Thêm danh mục mới</span>
                    </button>
                  ) : (
                    <div className="dropdown-add-cat-form" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={newCatInputRef}
                        type="text"
                        className="dropdown-add-cat-input"
                        placeholder="Tên danh mục mới..."
                        value={newCatInputName}
                        onChange={(e) => setNewCatInputName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateNewCategory();
                          } else if (e.key === 'Escape') {
                            setIsAddingNewCategory(false);
                          }
                        }}
                        maxLength={40}
                      />
                      <div className="dropdown-add-cat-btns">
                        <button
                          type="button"
                          className="dropdown-cat-confirm-btn"
                          onClick={handleCreateNewCategory}
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          className="dropdown-cat-cancel-btn"
                          onClick={() => setIsAddingNewCategory(false)}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
    
      </div>
    </div>
  );
}
