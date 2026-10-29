import React, { useEffect, useId, useRef, useState } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useToastStore } from '../../stores/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import { getUserErrorMessage } from '../../utils/userErrors';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { JarDialog } from './JarDialog';
import { jarsManagementText } from './jarsManagementCopy';
import './jars-management.css';

const PRESET_COLORS = [
  ['#059669', 'emerald'], ['#3B82F6', 'blue'], ['#7C3AED', 'purple'],
  ['#F97316', 'orange'], ['#EF4444', 'red'], ['#0891B2', 'teal'],
  ['#4F46E5', 'indigo'], ['#D97706', 'amber'], ['#EC4899', 'pink'],
];
const parseAmount = (value) => Number(String(value).replace(/\D/g, '')) || 0;

export function JarModal({ isOpen, onClose, jarToEdit = null }) {
  const { createJar, updateJar } = useJarStore();
  const { addToast } = useToastStore();
  const { lang } = useTranslation();
  const text = (key, values) => jarsManagementText(lang, key, values);
  const id = useId();
  const formId = `${id}-jar-form`;
  const nameInputRef = useRef(null);
  const targetInputRef = useRef(null);
  const initialInputRef = useRef(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isEditing = Boolean(jarToEdit);

  useEffect(() => {
    if (!isOpen) return;
    setName(jarToEdit?.name || '');
    setTarget(jarToEdit?.target ? formatInputNumber(jarToEdit.target) : '');
    setInitialAmount('');
    setTargetDate(jarToEdit?.targetDate?.slice(0, 10) || '');
    setColor(jarToEdit?.color || '#3B82F6');
    setError(null);
  }, [isOpen, jarToEdit]);

  const cleanTarget = parseAmount(target);
  const current = isEditing ? Number(jarToEdit.current) || 0 : parseAmount(initialAmount);
  const remaining = Math.max(0, cleanTarget - current);
  const updateAmount = (setter) => (event) => {
    const digits = event.target.value.replace(/\D/g, '');
    setter(digits ? formatInputNumber(digits) : '');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    if (!name.trim()) {
      setError({ field: 'name', message: text('nameRequired') });
      nameInputRef.current?.focus();
      return;
    }
    if (!Number.isSafeInteger(cleanTarget) || cleanTarget <= 0) {
      setError({ field: 'target', message: text('targetRequired') });
      targetInputRef.current?.focus();
      return;
    }
    if (!Number.isSafeInteger(current) || current < 0) {
      setError({ field: 'initial', message: text('initialInvalid') });
      initialInputRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const details = {
        name: name.trim(), target: cleanTarget, targetDate: targetDate || null,
        color, category: jarToEdit?.category || 'Mục tiêu chung', icon: jarToEdit?.icon || '🫙',
      };
      if (isEditing) await updateJar(jarToEdit.id, details);
      else await createJar({ ...details, current });
      addToast({ type: 'success', message: text(isEditing ? 'updated' : 'created', { name: name.trim() }) });
      onClose();
    } catch (err) {
      setError({ field: 'save', message: getUserErrorMessage(err, 'error.save') });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <JarDialog isOpen={isOpen} onClose={onClose} title={text(isEditing ? 'editTitle' : 'createTitle')}
      subtitle={text(isEditing ? 'editSubtitle' : 'createSubtitle')} className="jar-management-dialog"
      busy={isSubmitting} initialFocusRef={nameInputRef}
      footer={<>
        <button type="button" className="jm-button jm-button-secondary" onClick={onClose} disabled={isSubmitting}>{text('cancel')}</button>
        <button type="submit" form={formId} className="jm-button jm-button-primary" disabled={isSubmitting}>
          {text(isSubmitting ? 'saving' : isEditing ? 'saveChanges' : 'createAction')}
        </button>
      </>}>
      <form id={formId} onSubmit={handleSubmit} className="jm-form" noValidate>
        <div className="jm-field">
          <label htmlFor={`${id}-name`}>{text('name')}</label>
          <input id={`${id}-name`} ref={nameInputRef} className="jm-input" value={name}
            onChange={(event) => setName(event.target.value)} placeholder={text('namePlaceholder')}
            maxLength={40} required disabled={isSubmitting} aria-invalid={error?.field === 'name'}
            aria-describedby={error?.field === 'name' ? `${id}-error` : undefined} />
        </div>
        <div className="jm-two-columns">
          <div className="jm-field">
            <label htmlFor={`${id}-target`}>{text('target')} <span className="jm-unit">VND</span></label>
            <input id={`${id}-target`} ref={targetInputRef} className="jm-input jm-money-input" inputMode="numeric"
              value={target} onChange={updateAmount(setTarget)} placeholder="0" required disabled={isSubmitting}
              aria-invalid={error?.field === 'target'} aria-describedby={error?.field === 'target' ? `${id}-error` : undefined} />
          </div>
          <div className="jm-field">
            <label htmlFor={`${id}-date`}>{text('date')} <span className="jm-optional">{text('optional')}</span></label>
            <CustomDatePicker id={`${id}-date`} inputClassName="jm-input" value={targetDate}
              onChange={setTargetDate} disabled={isSubmitting} />
          </div>
        </div>
        {isEditing ? (
          <div className="jm-balance-readonly" role="note">
            <span>{text('currentBalance')}<strong>{formatCurrency(current, { locale: lang })}</strong></span>
            <p>{text('changeBalanceHint')}</p>
          </div>
        ) : (
          <div className="jm-field">
            <label htmlFor={`${id}-initial`}>{text('initial')} <span className="jm-optional">{text('optional')}</span> <span className="jm-unit">VND</span></label>
            <input id={`${id}-initial`} ref={initialInputRef} className="jm-input jm-money-input" inputMode="numeric"
              value={initialAmount} onChange={updateAmount(setInitialAmount)} placeholder="0" disabled={isSubmitting}
              aria-invalid={error?.field === 'initial'} aria-describedby={`${id}-initial-hint${error?.field === 'initial' ? ` ${id}-error` : ''}`} />
            <p className="jm-field-hint" id={`${id}-initial-hint`}>{text('initialHint')}</p>
          </div>
        )}
        <fieldset className="jm-colors" disabled={isSubmitting}>
          <legend>{text('color')}</legend>
          <div className="jm-color-options">
            {PRESET_COLORS.map(([hex, colorName]) => (
              <label className="jm-color-option" key={hex} title={text(colorName)}>
                <input type="radio" name={`${id}-color`} value={hex} checked={color === hex}
                  onChange={() => setColor(hex)} aria-label={text(colorName)} />
                <span className="jm-color-swatch" style={{ '--jm-swatch': hex }} aria-hidden="true">
                  {color === hex && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4L19 6" /></svg>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {cleanTarget > 0 && Number.isSafeInteger(cleanTarget) && (
          <div className="jm-remaining" aria-live="polite"><span>{text('remaining')}</span><strong>{formatCurrency(remaining, { locale: lang })}</strong></div>
        )}
        {error && <p id={`${id}-error`} className="jm-error" role="alert">{error.message}</p>}
      </form>
    </JarDialog>
  );
}
