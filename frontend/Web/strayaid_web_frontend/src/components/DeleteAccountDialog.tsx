import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../ui/Modal";
import { deleteAccount } from "../services/accountService";
import { errorMessage } from "../utils/errors";

/** Settings → Delete account: explains what goes and what stays, then asks for DELETE and the password. */
function DeleteAccountDialog({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (caught) {
      setError(errorMessage(caught));
      setDeleting(false);
    }
  };

  return (
    <Modal
      title="Delete your account?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Keep my account</button>
          <button type="submit" form="delete-account-form" className="btn btn-danger" disabled={confirmText !== "DELETE" || deleting}>
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </>
      }
    >
      <form id="delete-account-form" className="stack" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <p>
          Your name, email, phone and photo are removed straight away, along with your follows, likes, saved posts and
          notifications. Your reports stay on their rescue cases without your name, so rescues already under way aren't
          interrupted. This can't be undone.
        </p>
        <p className="small muted">
          <Link to="/legal/delete-account" target="_blank">What is deleted and what is kept</Link>
        </p>
        <label className="field">
          <span className="field-label">Type DELETE to confirm</span>
          <input className="input" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" />
        </label>
        <div className="field">
          <label className="field-label" htmlFor="delete-password">Your password</label>
          <input
            id="delete-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="delete-password-hint"
          />
          <span id="delete-password-hint" className="field-hint">Signed up with Google and never set a password? Leave this empty.</span>
        </div>
      </form>
    </Modal>
  );
}

export default DeleteAccountDialog;
