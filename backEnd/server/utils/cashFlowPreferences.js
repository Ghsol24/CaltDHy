'use strict';

const modes = new Set(['daily', '3months', '6months']);
const series = new Set(['expense', 'income', 'both']);
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
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
    if (!keys.length || keys.some(key => !['analyticsExcludeRecurring', 'cashFlow'].includes(key))) return false;
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
    return fields;
}

module.exports = { validCashFlowView, publicCashFlowPreferences, validPreferencesUpdate, preferenceUpdateFields };
