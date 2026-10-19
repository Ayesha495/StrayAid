import { useState } from "react";
import { Copy, Receipt } from "lucide-react";
import Modal from "../../ui/Modal";
import { formatPkr } from "../../utils/format";
import { errorMessage } from "../../utils/errors";

type Bank = { bank?: string; account_name?: string; account_number?: string };

const PRESETS = [500, 1000, 2500, 5000];

/**
 * Sponsor an animal or give to a shelter: transfer to the organization's bank account,
 * then attach the receipt. The organization confirms it once the money arrives.
 * (There's no payment gateway; this is the same flow as the mobile app.)
 */
function PledgeForm({ title, intro, bank, allowMonthly = false, onSubmit, onClose }: {
  title: string;
  intro: string;
  bank: Bank | null;
  allowMonthly?: boolean;
  onSubmit: (data: FormData) => Promise<unknown>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number | "">(1000);
  const [monthly, setMonthly] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!amount || amount < 100) return setError("The smallest amount is Rs 100.");
    if (!receipt) return setError("Attach a photo or screenshot of your transfer receipt.");
    const data = new FormData();
    data.append("amount_pkr", String(amount));
    if (allowMonthly) data.append("monthly", String(monthly));
    data.append("receipt", receipt);
    setSaving(true);
    try {
      await onSubmit(data);
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!bank?.account_number) return;
    await navigator.clipboard?.writeText(bank.account_number).catch(() => {});
    setCopied(true);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="pledge-form" className="btn btn-primary" disabled={saving || !bank?.account_number}>
            {saving ? "Sending…" : `Send ${amount ? formatPkr(amount) : ""} receipt`}
          </button>
        </>
      }
    >
      <form id="pledge-form" className="stack" onSubmit={submit}>
        <p className="muted">{intro}</p>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

        {bank?.account_number ? (
          <div className="bank-card">
            <div className="small muted">1. Transfer to</div>
            <div className="strong">{bank.account_name}</div>
            <div className="small">{bank.bank}</div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="mono">{bank.account_number}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copy}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        ) : (
          <div className="alert alert-info">This rescue team hasn't added bank details yet. Message them to ask how to help.</div>
        )}

        <div className="field">
          <span className="field-label">2. Amount</span>
          <div className="filter-row">
            {PRESETS.map((preset) => (
              <button key={preset} type="button" className="filter-pill" aria-pressed={amount === preset} onClick={() => setAmount(preset)}>{formatPkr(preset)}</button>
            ))}
          </div>
          <input
            className="input"
            type="number"
            min={100}
            max={500000}
            value={amount}
            aria-label="Amount in rupees"
            onChange={(event) => setAmount(event.target.value === "" ? "" : Number(event.target.value))}
          />
        </div>

        {allowMonthly ? (
          <label className="check">
            <input type="checkbox" checked={monthly} onChange={(event) => setMonthly(event.target.checked)} />
            I'll give this every month
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">3. Transfer receipt</span>
          <input className="input" type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
          <span className="field-hint row"><Receipt size={13} /> A screenshot from your banking app is fine.</span>
        </label>
      </form>
    </Modal>
  );
}

export default PledgeForm;
