'use strict';
const { publicCashFlowPreferences, publicNotifications, publicSidebarPinnedGroups } = require('./cashFlowPreferences');

function publicPreferences(preferences) {
    return {
        analyticsExcludeRecurring: preferences?.analyticsExcludeRecurring === true,
        cashFlow: publicCashFlowPreferences(preferences?.cashFlow),
        sidebarPinnedGroups: publicSidebarPinnedGroups(preferences?.sidebarPinnedGroups),
        notifications: publicNotifications(preferences?.notifications)
    };
}

function publicUser(user) {
    return {
        id: user._id?.toString() || user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        emailVerified: user.emailVerified === true,
        twoFactorEnabled: user.twoFactor?.enabled === true,
        // Cần nạp user với '+password +oauth.googleId +oauth.facebookId'; chỉ kết quả đúng/sai được trả ra ngoài.
        hasPassword: typeof user.password === 'string' && user.password.length > 0,
        linkedProviders: ['google', 'facebook'].filter(provider => Boolean(user.oauth?.[provider + 'Id'])),
        preferences: publicPreferences(user.preferences)
    };
}

module.exports = { publicPreferences, publicUser };
