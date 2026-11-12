'use strict';
const { publicCashFlowPreferences, publicNotifications } = require('./cashFlowPreferences');

function publicPreferences(preferences) {
    return {
        analyticsExcludeRecurring: preferences?.analyticsExcludeRecurring === true,
        cashFlow: publicCashFlowPreferences(preferences?.cashFlow),
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
        preferences: publicPreferences(user.preferences)
    };
}

module.exports = { publicPreferences, publicUser };
