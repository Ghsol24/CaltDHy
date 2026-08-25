import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { WalletsTab } from './WalletsTab';
import { BudgetsTab } from './BudgetsTab';
import { RecurringTab } from './RecurringTab';

export function PlanView() {
  const { planSubTab, setPlanSubTab } = useSpendingStore();

  const tabs = [
    { id: 'wallets', label: 'Ví & Tài khoản', icon: '💳' },
    { id: 'budgets', label: 'Hạn mức Ngân sách', icon: '📊' },
    { id: 'recurring', label: 'Khoản định kỳ', icon: '🔄' }
  ];

  return (
    <div className="plan-feature-view">
      {/* Sub-tab Switcher Header */}
      <div className="plan-subtabs-bar" role="tablist" aria-label="Các mục kế hoạch tài chính">
        {tabs.map((tab) => {
          const isActive = (planSubTab || 'wallets') === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`plan-subtab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setPlanSubTab(tab.id)}
            >
              <span className="plan-subtab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="plan-subtab-text">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels Content */}
      <div className="plan-tab-content">
        {(planSubTab === 'wallets' || !planSubTab) && <WalletsTab />}
        {planSubTab === 'budgets' && <BudgetsTab />}
        {planSubTab === 'recurring' && <RecurringTab />}
      </div>
    </div>
  );
}
