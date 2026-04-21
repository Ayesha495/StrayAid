import { useEffect } from "react";

type SponsorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  donationInfo?: string | null;
};

function SponsorModal({ isOpen, onClose, title, donationInfo }: SponsorModalProps) {
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

  if (!isOpen) {
    return null;
  }

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
          <div>
            <p className="modal-eyebrow">Donation Information</p>
            <h2 id="donation-modal-title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close donation information">
            x
          </button>
        </div>
        <p className="modal-copy">
          {donationInfo?.trim() || "This organization has not shared donation information for this animal yet."}
        </p>
      </div>
    </div>
  );
}

export default SponsorModal;
