import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { PlanOverviewTab } from './PlanOverviewTab';
import { WalletsTab } from './WalletsTab';
import { BudgetsTab } from './BudgetsTab';
import { RecurringTab } from './RecurringTab';

export function PlanView() {
  const { planSubTab } = useSpendingStore();

  return (
    <div className="plan-feature-view">
      {/* Content starts directly with corresponding sub-tab without duplicate top tabs */}
      <div className="plan-tab-content">
        {(planSubTab === 'overview' || !planSubTab) && <PlanOverviewTab />}
        {planSubTab === 'wallets' && <WalletsTab />}
        {planSubTab === 'budgets' && <BudgetsTab />}
        {planSubTab === 'recurring' && <RecurringTab />}
      </div>
    </div>
  );
}
