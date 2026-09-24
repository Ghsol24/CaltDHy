import { useEffect, useRef } from 'react';
import { useLangStore } from '../stores/useLangStore';

const sourceText = new WeakMap();
const appliedText = new WeakMap();
const sourceAttributes = new WeakMap();
const appliedAttributes = new WeakMap();
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'data-hover-label', 'data-tooltip'];

function preserveWhitespace(original, translated) {
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function localizeTextNode(node, locale, translateLegacyText) {
  const current = node.nodeValue || '';
  if (!current.trim()) return;
  if (appliedText.get(node) !== current) sourceText.set(node, current);
  const source = sourceText.get(node) || current;
  const translated = preserveWhitespace(source, translateLegacyText(locale, source.trim()));
  appliedText.set(node, translated);
  if (current !== translated) node.nodeValue = translated;
}

function localizeElement(element, locale, translateLegacyText) {
  const sources = sourceAttributes.get(element) || {};
  const applied = appliedAttributes.get(element) || {};
  for (const attribute of ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute) || '';
    if (applied[attribute] !== current) sources[attribute] = current;
    const translated = translateLegacyText(locale, sources[attribute]);
    applied[attribute] = translated;
    if (current !== translated) element.setAttribute(attribute, translated);
  }
  sourceAttributes.set(element, sources);
  appliedAttributes.set(element, applied);
}

function localizeTree(root, locale, translateLegacyText) {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root, locale, translateLegacyText);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root, locale, translateLegacyText);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node, locale, translateLegacyText);
    else localizeElement(node, locale, translateLegacyText);
    node = walker.nextNode();
  }
}

export function LocalizationObserver() {
  const locale = useLangStore((state) => state.lang);
  const previousLocaleRef = useRef(locale);

  useEffect(() => {
    const previousLocale = previousLocaleRef.current;
    previousLocaleRef.current = locale;
    // Vietnamese is the legacy DOM's source language. Initial vi needs no
    // catalog download, DOM walk or long-lived observer.
    if (locale === 'vi' && previousLocale === 'vi') return undefined;

    let cancelled = false;
    let observer;
    import('./legacyTranslations').then(({ translateLegacyText }) => {
      if (cancelled) return;
      localizeTree(document.body, locale, translateLegacyText);
      // When returning to vi, restore existing translated nodes once. New
      // React nodes already contain the original Vietnamese source text.
      if (locale === 'vi') return;
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') localizeTextNode(mutation.target, locale, translateLegacyText);
          else if (mutation.type === 'attributes') localizeElement(mutation.target, locale, translateLegacyText);
          else for (const node of mutation.addedNodes) localizeTree(node, locale, translateLegacyText);
        }
      });
      observer.observe(document.body, {
        subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES,
      });
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [locale]);

  return null;
}
