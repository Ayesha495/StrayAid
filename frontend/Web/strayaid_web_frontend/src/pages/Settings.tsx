import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Camera, LogOut, Trash2 } from "lucide-react";
import { changePassword, getMyProfile, updateMyProfile } from "../services/accountService";
import { clearSession, syncCurrentUser } from "../services/authService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import { ErrorState, LoadingRows } from "../ui/States";
import OrgProfileForm from "../components/OrgProfileForm";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import { formatDate } from "../utils/format";
import { errorMessage } from "../utils/errors";

function AccountSettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const profile = useApi(getMyProfile);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (profile.error && !profile.data) return <ErrorState message={errorMessage(profile.error)} onRetry={profile.reload} />;
  if (!profile.data) return <LoadingRows rows={3} height={80} />;
  const me = profile.data;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (avatar) data.set("avatar", avatar);
    else data.delete("avatar");
    setSaving(true);
    try {
      profile.setData(await updateMyProfile(data));
      await syncCurrentUser();
      toast({ title: "Profile saved" });
    } catch (error) {
      toast({ title: "Couldn't save your profile", body: errorMessage(error), tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (passwords.next.length < 8) return setPasswordError("Use at least 8 characters.");
    if (passwords.next !== passwords.confirm) return setPasswordError("The new passwords don't match.");
    setChanging(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      toast({ title: "Password changed" });
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="stack">
      <form className="card" onSubmit={save}>
        <div className="card-header">
          <div>
            <h2>Your account</h2>
            <p className="small muted">{me.email} · member since {formatDate(me.member_since)}</p>
          </div>
        </div>
        <div className="card-body form-grid">
          <div className="span-2 animal-photo-field">
            <Avatar name={`${me.first_name} ${me.last_name}`.trim() || me.email} src={preview ?? me.avatar} size={72} />
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Profile photo</span>
              <label className="btn btn-secondary upload-btn">
                <Camera size={16} aria-hidden="true" /> {preview || me.avatar ? "Change photo" : "Upload photo"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  name="avatar"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setAvatar(file);
                    if (file) setPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
              <span className="field-hint">{avatar ? avatar.name : "Shown next to your comments and messages."}</span>
            </div>
          </div>
          <label className="field">
            <span className="field-label">First name</span>
            <input className="input" name="first_name" defaultValue={me.first_name} />
          </label>
          <label className="field">
            <span className="field-label">Last name</span>
            <input className="input" name="last_name" defaultValue={me.last_name} />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input className="input" name="phone" type="tel" defaultValue={me.phone} placeholder="+92 300 1234567" />
          </label>
          <label className="field">
            <span className="field-label">Area</span>
            <input className="input" name="area" defaultValue={me.area} placeholder="e.g. G-11, Islamabad" />
          </label>
        </div>
        <div className="modal-footer">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>

      <form className="card" onSubmit={submitPassword}>
        <div className="card-header"><h2>Change password</h2></div>
        <div className="card-body form-grid">
          {passwordError ? <div className="alert alert-error span-2" role="alert">{passwordError}</div> : null}
          <label className="field span-2">
            <span className="field-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" required value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" required value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Repeat new password</span>
            <input className="input" type="password" autoComplete="new-password" required value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
          </label>
        </div>
        <div className="modal-footer">
          <button type="submit" className="btn btn-secondary" disabled={changing}>{changing ? "Changing…" : "Change password"}</button>
        </div>
      </form>

      <div className="card card-pad row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span><strong>Log out</strong><span className="small muted" style={{ display: "block" }}>Sign out of StrayAid on this browser.</span></span>
        <button type="button" className="btn btn-danger-outline" onClick={() => { clearSession(); navigate("/login"); }}>
          <LogOut size={16} aria-hidden="true" /> Log out
        </button>
      </div>

      <div className="card card-pad row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span>
          <strong>Delete account</strong>
          <span className="small muted" style={{ display: "block" }}>Permanently remove your account and personal details.</span>
        </span>
        <button type="button" className="btn btn-danger-outline" onClick={() => setDeleting(true)}>
          <Trash2 size={16} aria-hidden="true" /> Delete account…
        </button>
      </div>

      {deleting ? (
        <DeleteAccountDialog
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            clearSession();
            toast({ title: "Your account has been deleted" });
            navigate("/", { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

function Settings() {
  const toast = useToast();
  const { isOrganization, organization, setOrganization } = useShell();
  const [params, setParams] = useSearchParams();
  const tab = isOrganization && params.get("tab") !== "account" ? "organization" : "account";

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>{isOrganization ? "Your organization's public profile and your login." : "Your profile and login."}</p>
        </div>
      </div>

      {isOrganization ? (
        <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
          <button type="button" role="tab" className="tab" aria-selected={tab === "organization"} onClick={() => setParams({}, { replace: true })}>Organization</button>
          <button type="button" role="tab" className="tab" aria-selected={tab === "account"} onClick={() => setParams({ tab: "account" }, { replace: true })}>Account</button>
        </div>
      ) : null}

      {tab === "organization" ? (
        organization ? (
          <OrgProfileForm
            organization={organization}
            onSaved={(saved) => {
              setOrganization(saved);
              toast({ title: "Organization profile saved" });
            }}
          />
        ) : (
          <LoadingRows rows={3} height={160} />
        )
      ) : (
        <>
          <AccountSettings />
          {!isOrganization ? (
            <div className="card card-pad row" style={{ marginTop: 16, gap: 16, flexWrap: "wrap" }}>
              <Building2 size={22} color="var(--green-700)" />
              <span style={{ flex: 1, minWidth: 200 }}>
                <strong>Run a rescue or shelter?</strong>
                <span className="small muted" style={{ display: "block" }}>Register your organization to accept cases and manage animals.</span>
              </span>
              <Link to="/organization/register" className="btn btn-primary">Register organization</Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default Settings;
