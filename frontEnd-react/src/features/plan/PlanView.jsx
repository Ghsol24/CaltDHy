import React, { lazy, Suspense } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { PlanOverviewTab } from './PlanOverviewTab';
import { WalletsTab } from './WalletsTab';
import { BudgetsTab } from './BudgetsTab';
import { RecurringTab } from './RecurringTab';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

const DebtsTab = lazy(() => import('../debts/DebtsTab').then((module) => ({ default: module.DebtsTab })));

export function PlanView() {
  const planSubTab = useSpendingStore((s) => s.planSubTab);

  return (
    <div className="plan-feature-view">
      {/* Content starts directly with corresponding sub-tab without duplicate top tabs */}
      <div className="plan-tab-content">
        {(planSubTab === 'overview' || !planSubTab) && <PlanOverviewTab />}
        {planSubTab === 'wallets' && <WalletsTab />}
        {planSubTab === 'budgets' && <BudgetsTab />}
        {planSubTab === 'recurring' && <RecurringTab />}
        {planSubTab === 'debts' && <Suspense fallback={<PageSkeleton />}><DebtsTab /></Suspense>}
      </div>
    </div>
  );
}
