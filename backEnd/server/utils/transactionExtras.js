'use strict';

const MAX_TAGS = 10;

/** Normalised tag list, or null when the input is not a valid list of short labels. */
function cleanTags(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > MAX_TAGS * 2) return null;
    const tags = [];
    for (const item of value) {
        if (typeof item !== 'string') return null;
        // Lowercase so "Đà Lạt" and "đà lạt" are one tag; commas separate tags in snapshots.
        const tag = item.replace(/[#,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!tag) continue;
        if (tag.length > 30) return null;
        if (!tags.includes(tag)) tags.push(tag);
    }
    return tags.length > MAX_TAGS ? null : tags;
}

/** Trimmed long note, or null when it is not a string of at most 2000 characters. */
function cleanNote(value) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string' || value.length > 2000) return null;
    return value.trim();
}

const snapshotTags = tags => (Array.isArray(tags) ? tags : []).join(', ');

module.exports = { cleanTags, cleanNote, snapshotTags, MAX_TAGS };
