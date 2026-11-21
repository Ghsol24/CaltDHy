import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { captureLinkReturn } from '../../services/oauthFlow';
import { GuideModal } from '../../features/guide/GuideModal';
import { AccountModal } from '../../features/account/AccountModal';
import { OfflineSyncNotice } from '../layout/OfflineSyncNotice';

export const AppUtilities = React.memo(function AppUtilities() {
  const isSettingsOpen = useSpendingStore((state) => state.isSettingsOpen);
  const location = useLocation();
  const navigate = useNavigate();

  // Coming back from linking Google/Facebook in Settings: reopen Data & privacy with the result.
  useEffect(() => {
    if (!/[?&](linked|link_error)=/.test(location.search)) return;
    const recognised = captureLinkReturn(location.search);
    navigate({ pathname: location.pathname, search: '' }, { replace: true });
    if (recognised) useSpendingStore.getState().openSettingsModal('data');
  }, [location.search, location.pathname, navigate]);

  return (
    <>
      {isSettingsOpen && <AccountModal />}
      <GuideModal />
      <OfflineSyncNotice />
    </>
  );
});
