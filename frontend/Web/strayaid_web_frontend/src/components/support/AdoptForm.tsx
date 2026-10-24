import { useState } from "react";
import Modal from "../../ui/Modal";
import { applyToAdopt } from "../../services/socialService";
import { errorMessage } from "../../utils/errors";
import type { AdoptionForm } from "../../types/api";

const STEPS = ["About you", "Home & lifestyle", "Why adopt"];

const EMPTY: AdoptionForm = {
  full_name: "",
  phone: "",
  home_type: "house",
  has_other_pets: false,
  city: "",
  ownership: "own",
  landlord_allows_pets: null,
  household_size: "",
  has_children: false,
  hours_alone: "",
  experience: "",
  reason: "",
  care_plan: "",
  agrees_home_visit: false,
  agrees_return_policy: false,
};

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label" style={{ marginBottom: 6 }}>{label}</legend>
      <div className="filter-row">
        <button type="button" className="filter-pill" aria-pressed={value === true} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className="filter-pill" aria-pressed={value === false} onClick={() => onChange(false)}>No</button>
      </div>
    </fieldset>
  );
}

/** The adoption application, in three short steps (same questions as the mobile app). */
function AdoptForm({ animalId, animalName, defaultName = "", onClose, onDone }: {
  animalId: number;
  animalName: string;
  defaultName?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AdoptionForm>({ ...EMPTY, full_name: defaultName });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharesDetails, setSharesDetails] = useState(false);
  const set = <K extends keyof AdoptionForm>(key: K, value: AdoptionForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const stepValid = [
    form.full_name.trim().length >= 3 && form.phone.trim().length >= 10,
    Boolean(form.city.trim() && form.household_size !== "" && form.hours_alone !== "" && form.experience),
    Boolean(form.reason.trim() && form.agrees_home_visit && form.agrees_return_policy && sharesDetails),
  ];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await applyToAdopt(animalId, form);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Adopt ${animalName}`}
      onClose={onClose}
      footer={
        <>
          {step > 0 ? <button type="button" className="btn btn-secondary" style={{ marginRight: "auto" }} onClick={() => setStep(step - 1)}>Back</button> : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!stepValid[step] || saving} onClick={submit}>
              {saving ? "Sending…" : "Send application"}
            </button>
          )}
        </>
      }
    >
      <ol className="steps" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : undefined} aria-current={index === step ? "step" : undefined}>
            <span>{index + 1}</span> {label}
          </li>
        ))}
      </ol>

      {error ? <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div> : null}

      {step === 0 ? (
        <div className="form-grid">
          <p className="span-2 small muted">Only the rescue team caring for {animalName} sees your answers.</p>
          <label className="field span-2">
            <span className="field-label">Full name</span>
            <input className="input" value={form.full_name} onChange={(event) => set("full_name", event.target.value)} autoComplete="name" />
          </label>
          <label className="field span-2">
            <span className="field-label">Phone</span>
            <input className="input" type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+92 300 1234567" autoComplete="tel" />
            <span className="field-hint">The rescue team calls you to arrange a visit.</span>
          </label>
          <label className="field">
            <span className="field-label">Home</span>
            <select className="select" value={form.home_type} onChange={(event) => set("home_type", event.target.value)}>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="other">Other</option>
            </select>
          </label>
          <YesNo label="Other pets at home?" value={form.has_other_pets} onChange={(value) => set("has_other_pets", value)} />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="form-grid">
          <label className="field">
            <span className="field-label">City</span>
            <input className="input" value={form.city} onChange={(event) => set("city", event.target.value)} autoComplete="address-level2" />
          </label>
          <label className="field">
            <span className="field-label">Do you own or rent?</span>
            <select className="select" value={form.ownership} onChange={(event) => set("ownership", event.target.value)}>
              <option value="own">Own</option>
              <option value="rent">Rent</option>
            </select>
          </label>
          {form.ownership === "rent" ? (
            <div className="span-2"><YesNo label="Does your landlord allow pets?" value={form.landlord_allows_pets} onChange={(value) => set("landlord_allows_pets", value)} /></div>
          ) : null}
          <label className="field">
            <span className="field-label">People in your home</span>
            <input className="input" type="number" min={1} max={30} value={form.household_size} onChange={(event) => set("household_size", event.target.value === "" ? "" : Number(event.target.value))} />
          </label>
          <label className="field">
            <span className="field-label">Hours alone per day</span>
            <input className="input" type="number" min={0} max={24} value={form.hours_alone} onChange={(event) => set("hours_alone", event.target.value === "" ? "" : Number(event.target.value))} />
          </label>
          <YesNo label="Children at home?" value={form.has_children} onChange={(value) => set("has_children", value)} />
          <label className="field">
            <span className="field-label">Experience with pets</span>
            <select className="select" value={form.experience} onChange={(event) => set("experience", event.target.value)}>
              <option value="">Choose one</option>
              <option value="first_time">This would be my first pet</option>
              <option value="some">I've had pets before</option>
              <option value="experienced">Very experienced</option>
            </select>
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack">
          <label className="field">
            <span className="field-label">Why do you want to adopt {animalName}?</span>
            <textarea className="textarea" value={form.reason} onChange={(event) => set("reason", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Who looks after {animalName} when you're away? (optional)</span>
            <textarea className="textarea" rows={2} value={form.care_plan} onChange={(event) => set("care_plan", event.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.agrees_home_visit} onChange={(event) => set("agrees_home_visit", event.target.checked)} />
            I agree to a home visit before adoption.
          </label>
          <label className="check">
            <input type="checkbox" checked={form.agrees_return_policy} onChange={(event) => set("agrees_return_policy", event.target.checked)} />
            If it doesn't work out, I'll return {animalName} to the rescue team.
          </label>
          <label className="check">
            <input type="checkbox" checked={sharesDetails} onChange={(event) => setSharesDetails(event.target.checked)} />
            I agree to share these answers with the rescue team caring for {animalName}, so they can assess my application and contact me.
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

export default AdoptForm;
