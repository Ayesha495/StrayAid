import { useEffect, useState, type ReactNode } from "react";
import { Banknote, Check, Copy, Hash, Landmark, User, X } from "lucide-react";
import type { DonationInfo } from "../types/platform";

type SponsorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  donationInfo?: DonationInfo | null;
};

type DonationField = "bank" | "account_name" | "account_number";

function SponsorModal({ isOpen, onClose, title, donationInfo }: SponsorModalProps) {
  const [copiedField, setCopiedField] = useState<DonationField | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setCopiedField(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async (field: DonationField, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800);
    } catch {
      window.alert("Copy this value manually — clipboard access isn't available.");
    }
  };

  const fields: { key: DonationField; label: string; value: string; icon: ReactNode }[] = donationInfo
    ? [
        { key: "bank", label: "Bank", value: donationInfo.bank || "Not shared", icon: <Landmark size={16} /> },
        { key: "account_name", label: "Account Name", value: donationInfo.account_name || "Not shared", icon: <User size={16} /> },
        { key: "account_number", label: "Account Number", value: donationInfo.account_number || "Not shared", icon: <Hash size={16} /> },
      ]
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-modal-title"
      >
        <div className="modal-header">
          <div className="donation-modal-heading">
            <span className="donation-modal-icon"><Banknote size={20} /></span>
            <div>
              <p className="modal-eyebrow">Donation Information</p>
              <h2 id="donation-modal-title">{title}</h2>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close donation information">
            <X size={18} />
          </button>
        </div>
        {donationInfo ? (
          <div className="donation-info-card">
            {fields.map((field) => (
              <div className="donation-info-row" key={field.key}>
                <span className="donation-info-icon">{field.icon}</span>
                <div className="donation-info-text">
                  <p className="donation-info-label">{field.label}</p>
                  <p className="donation-info-value">{field.value}</p>
                </div>
                {field.value !== "Not shared" ? (
                  <button
                    type="button"
                    className="donation-info-copy-btn"
                    onClick={() => handleCopy(field.key, field.value)}
                    aria-label={`Copy ${field.label}`}
                  >
                    {copiedField === field.key ? <Check size={14} /> : <Copy size={14} />}
                    {copiedField === field.key ? "Copied" : "Copy"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="modal-copy">This organization has not shared donation information for this animal yet.</p>
        )}
      </div>
    </div>
  );
}

export default SponsorModal;
