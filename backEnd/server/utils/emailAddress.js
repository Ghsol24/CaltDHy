'use strict';

// Accept one mailbox only; never pass address lists/comments to the mail transport.
function validEmail(value) {
    if (typeof value !== 'string' || value.trim().length > 254) return false;
    const parts = value.trim().split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    return local.length <= 64 && /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) &&
        domain.includes('.') && domain.split('.').every(label =>
            /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}

const normalizeEmail = value => value.trim().toLowerCase();

module.exports = { validEmail, normalizeEmail };
