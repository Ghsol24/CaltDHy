'use strict';

const modes = new Set(['daily', '3months', '6months']);
const series = new Set(['expense', 'income', 'both']);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const reminderLocales = new Set(['vi', 'en', 'zh-CN']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validCashFlowView(value) {
    return isObject(value) && Object.keys(value).length === 3 &&
        owns(value, 'mode') && modes.has(value.mode) &&
        owns(value, 'series') && series.has(value.series) &&
        owns(value, 'excludeRecurring') && typeof value.excludeRecurring === 'boolean';
}

function publicCashFlowPreferences(value) {
    const view = candidate => {
        const plain = typeof candidate?.toObject === 'function' ? candidate.toObject() : candidate;
        return validCashFlowView(plain) ? {
            mode: plain.mode,
            series: plain.series,
            excludeRecurring: plain.excludeRecurring
        } : null;
    };
    return { lastUsed: view(value?.lastUsed), pinnedDefault: view(value?.pinnedDefault) };
}

function validPreferencesUpdate(body) {
    if (!isObject(body)) return false;
    const keys = Object.keys(body);
    if (!keys.length || keys.some(key => !['analyticsExcludeRecurring', 'cashFlow', 'notifications'].includes(key))) return false;
    if (owns(body, 'notifications') && !validNotificationsUpdate(body.notifications)) return false;
    if (owns(body, 'analyticsExcludeRecurring') && typeof body.analyticsExcludeRecurring !== 'boolean') return false;
    if (owns(body, 'cashFlow')) {
        if (!isObject(body.cashFlow)) return false;
        const flowKeys = Object.keys(body.cashFlow);
        if (!flowKeys.length || flowKeys.some(key => !['lastUsed', 'pinnedDefault'].includes(key))) return false;
        if (owns(body.cashFlow, 'lastUsed') && !validCashFlowView(body.cashFlow.lastUsed)) return false;
        if (owns(body.cashFlow, 'pinnedDefault') && body.cashFlow.pinnedDefault !== null &&
            !validCashFlowView(body.cashFlow.pinnedDefault)) return false;
        if (owns(body, 'analyticsExcludeRecurring') && owns(body.cashFlow, 'lastUsed') &&
            body.analyticsExcludeRecurring !== body.cashFlow.lastUsed.excludeRecurring) return false;
    }
    return true;
}

function preferenceUpdateFields(body, existing) {
    const fields = {};
    if (owns(body, 'analyticsExcludeRecurring')) {
        fields['preferences.analyticsExcludeRecurring'] = body.analyticsExcludeRecurring;
        // Keep the established analytics filter compatible with a remembered view.
        // A pinned default remains an explicit, independent user choice.
        if (!owns(body.cashFlow || {}, 'lastUsed') && validCashFlowView(existing?.cashFlow?.lastUsed)) {
            fields['preferences.cashFlow.lastUsed.excludeRecurring'] = body.analyticsExcludeRecurring;
        }
    }
    if (owns(body, 'cashFlow')) {
        for (const key of Object.keys(body.cashFlow)) fields['preferences.cashFlow.' + key] = body.cashFlow[key];
        if (owns(body.cashFlow, 'lastUsed')) {
            fields['preferences.analyticsExcludeRecurring'] = body.cashFlow.lastUsed.excludeRecurring;
        }
    }
    if (owns(body, 'notifications')) {
        const update = body.notifications;
        for (const key of ['dueEmail', 'inactivityEmail', 'locale', 'promptDismissed']) {
            if (owns(update, key)) fields['preferences.notifications.' + key] = update[key];
        }
        if (owns(update, 'dailyReminder')) {
            fields['preferences.notifications.dailyReminder.enabled'] = update.dailyReminder.enabled;
            fields['preferences.notifications.dailyReminder.hour'] = update.dailyReminder.hour;
        }
        // Chỉ cho phép bỏ tạm dừng từ đây; đặt tạm dừng đi qua link có chữ ký trong email.
        if (owns(update, 'emailPausedUntil')) fields['preferences.notifications.emailPausedUntil'] = null;
    }
    return fields;
}

function validNotificationsUpdate(value) {
    if (!isObject(value)) return false;
    const keys = Object.keys(value);
    const booleans = ['dueEmail', 'inactivityEmail', 'promptDismissed'];
    if (!keys.length || keys.some(key => ![...booleans, 'dailyReminder', 'locale', 'emailPausedUntil'].includes(key))) return false;
    if (booleans.some(key => owns(value, key) && typeof value[key] !== 'boolean')) return false;
    if (owns(value, 'locale') && !reminderLocales.has(value.locale)) return false;
    if (owns(value, 'emailPausedUntil') && value.emailPausedUntil !== null) return false;
    if (owns(value, 'dailyReminder')) {
        const daily = value.dailyReminder;
        if (!isObject(daily) || Object.keys(daily).length !== 2 || typeof daily.enabled !== 'boolean' ||
            !Number.isInteger(daily.hour) || daily.hour < 6 || daily.hour > 23) return false;
    }
    return true;
}

function publicNotifications(value) {
    const hour = value?.dailyReminder?.hour;
    const paused = value?.emailPausedUntil ? new Date(value.emailPausedUntil) : null;
    return {
        dueEmail: value?.dueEmail === true,
        inactivityEmail: value?.inactivityEmail === true,
        dailyReminder: { enabled: value?.dailyReminder?.enabled === true,
            hour: Number.isInteger(hour) && hour >= 6 && hour <= 23 ? hour : 21 },
        locale: reminderLocales.has(value?.locale) ? value.locale : 'vi',
        emailPausedUntil: paused && paused > new Date() ? paused.toISOString() : null,
        promptDismissed: value?.promptDismissed === true
    };
}

module.exports = { publicNotifications, validCashFlowView, publicCashFlowPreferences, validPreferencesUpdate, preferenceUpdateFields };
