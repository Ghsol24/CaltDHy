'use strict';
function isFiniteInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value);
}
function isValidVNDAmount(value, { allowZero = false } = {}) {
    return isFiniteInteger(value) && (allowZero ? value >= 0 : value > 0);
}
module.exports = { isValidVNDAmount, isFiniteInteger };
