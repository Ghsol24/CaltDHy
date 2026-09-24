import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { GuideModal } from '../../features/guide/GuideModal';
import { ContextualSectionGuide } from '../../features/guide/ContextualSectionGuide';
import { AccountModal } from '../../features/account/AccountModal';

export const AppUtilities = React.memo(function AppUtilities() {
  const isSettingsOpen = useSpendingStore((state) => state.isSettingsOpen);

  return (
    <>
      {isSettingsOpen && <AccountModal />}
      <ContextualSectionGuide />
      <GuideModal />
    </>
  );
});
