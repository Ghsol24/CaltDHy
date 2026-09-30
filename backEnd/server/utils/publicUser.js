'use strict';

function publicPreferences(preferences) {
    return {
        analyticsExcludeRecurring: preferences?.analyticsExcludeRecurring === true
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
