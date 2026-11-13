import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extrasService as spendingService } from '../../../services/extrasService';
import { prepareReceiptImage } from '../../../utils/imageAttachment';
import { Icon } from '../../../components/ui/AppIcons';
import { cleanTag, MAX_TAGS } from '../transactionExtrasCopy';
import '../transaction-extras.css';

const MAX_RECEIPTS = 3;

/**
 * Optional details of one transaction: tags, a long note and receipt photos.
 * Photos of a saved transaction upload immediately; for a new one they wait in `pendingReceipts`
 * and the modal uploads them once the transaction exists.
 */
export function TransactionExtrasField({ copy, tags, setTags, note, setNote, transactionId, pendingReceipts, setPendingReceipts, suggestions = [] }) {
  const id = useId();
  const fileRef = useRef(null);
  const [open, setOpen] = useState(Boolean(tags.length || note));
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { loading } | { dataUrl }

  useEffect(() => {
    if (!transactionId) return undefined;
    let active = true;
    spendingService.listAttachments(transactionId).then((response) => {
      if (!active) return;
      setSaved(response.data || []);
      if (response.data?.length) setOpen(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [transactionId]);

  const addTag = (value) => {
    const tag = cleanTag(value);
    setDraft('');
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    setTags([...tags, tag]);
  };
  const onTagKey = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === 'Backspace' && !draft && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };
  const count = saved.length + pendingReceipts.length;
  const unused = suggestions.filter((tag) => !tags.includes(tag)).slice(0, 6);

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || count >= MAX_RECEIPTS) return;
    setError(''); setBusy(true);
    try {
      let dataUrl;
      try { dataUrl = await prepareReceiptImage(file); }
      catch { setError(copy.receiptInvalid); return; }
      if (!transactionId) { setPendingReceipts([...pendingReceipts, dataUrl]); return; }
      try {
        const response = await spendingService.addAttachment(transactionId, dataUrl);
        setSaved((items) => [...items, response.data]);
      } catch { setError(copy.receiptFailed); }
    } finally { setBusy(false); }
  };
  const removeSaved = async (attachmentId) => {
    setError('');
    try {
      await spendingService.deleteAttachment(transactionId, attachmentId);
      setSaved((items) => items.filter((item) => item.id !== attachmentId));
    } catch { setError(copy.receiptFailed); }
  };
  const openSaved = async (attachmentId) => {
    setPreview({ loading: true });
    try {
      const response = await spendingService.getAttachment(transactionId, attachmentId);
      setPreview({ dataUrl: response.data.dataUrl });
    } catch { setPreview(null); setError(copy.receiptFailed); }
  };

  return <div className={`txn-extras${open ? ' is-open' : ''}`}>
    <button type="button" className="txn-extras-toggle" aria-expanded={open} aria-controls={`${id}-panel`}
      onClick={() => setOpen((value) => !value)}>
      <Icon name="tag" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      <span>{copy.details}</span>
      {(tags.length > 0 || count > 0) && <span className="txn-extras-count">{tags.length + count}</span>}
      <Icon name="chevronDownAlt" className="txn-extras-chevron" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </button>
    {open && <div className="txn-extras-panel" id={`${id}-panel`}>
      <div className="txn-field-group">
        <label htmlFor={`${id}-tags`} className="txn-label"><span>{copy.tags}</span></label>
        <div className="txn-tag-box">
          {tags.map((tag) => <span key={tag} className="txn-tag-chip">
            #{tag}
            <button type="button" aria-label={copy.removeTag(tag)} onClick={() => setTags(tags.filter((item) => item !== tag))}>
              <Icon name="closeAlt" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </span>)}
          {tags.length < MAX_TAGS && <input id={`${id}-tags`} type="text" value={draft} maxLength={30} enterKeyHint="done"
            placeholder={tags.length ? '' : copy.tagsPlaceholder} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onTagKey} onBlur={() => draft && addTag(draft)} />}
        </div>
        {unused.length > 0 && <div className="txn-tag-suggestions">
          {unused.map((tag) => <button type="button" key={tag} onClick={() => addTag(tag)}>#{tag}</button>)}
        </div>}
        <p className="txn-field-hint">{copy.tagsHint(MAX_TAGS)}</p>
      </div>

      <div className="txn-field-group">
        <label htmlFor={`${id}-note`} className="txn-label"><span>{copy.longNote}</span></label>
        <textarea id={`${id}-note`} className="txn-input txn-extras-note" rows={3} maxLength={2000} value={note}
          placeholder={copy.longNotePlaceholder} onChange={(event) => setNote(event.target.value)} />
      </div>

      <div className="txn-field-group">
        <span className="txn-label"><span>{copy.receipts}</span><span className="txn-label-optional">{count}/{MAX_RECEIPTS}</span></span>
        <div className="txn-receipts">
          {saved.map((item) => <span key={item.id} className="txn-receipt">
            <button type="button" className="txn-receipt-open" aria-label={copy.viewReceipt} onClick={() => openSaved(item.id)}>
              <Icon name="fileText" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <small>{Math.max(1, Math.round(item.size / 1024))} KB</small>
            </button>
            <button type="button" className="txn-receipt-remove" aria-label={copy.removeReceipt} onClick={() => removeSaved(item.id)}>
              <Icon name="closeAlt" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </span>)}
          {pendingReceipts.map((dataUrl, index) => <span key={index} className="txn-receipt">
            <button type="button" className="txn-receipt-open" aria-label={copy.viewReceipt} onClick={() => setPreview({ dataUrl })}>
              <img src={dataUrl} alt="" />
            </button>
            <button type="button" className="txn-receipt-remove" aria-label={copy.removeReceipt}
              onClick={() => setPendingReceipts(pendingReceipts.filter((_, itemIndex) => itemIndex !== index))}>
              <Icon name="closeAlt" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </span>)}
          {count < MAX_RECEIPTS && <button type="button" className="txn-receipt-add" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
            <span>{copy.addReceipt}</span>
          </button>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
        </div>
        <p className="txn-field-hint">{copy.receiptsHint}</p>
        {error && <p className="txn-extras-error" role="alert">{error}</p>}
      </div>
    </div>}
    {/* Portalled: the dialog card clips and transforms its content, which would trap a fixed overlay. */}
    {preview && createPortal(<div className="txn-receipt-preview" role="dialog" aria-modal="true" aria-label={copy.viewReceipt}
      onClick={() => setPreview(null)}>
      {preview.loading ? <p>{copy.receiptLoading}</p> : <img src={preview.dataUrl} alt={copy.viewReceipt} />}
      <button type="button" aria-label={copy.closeReceipt} onClick={() => setPreview(null)}>
        <Icon name="closeAlt" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </button>
    </div>, document.body)}
  </div>;
}
