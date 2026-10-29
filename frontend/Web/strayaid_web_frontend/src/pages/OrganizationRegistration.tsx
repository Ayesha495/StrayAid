import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check, UploadCloud } from "lucide-react";
import AuthenticatedShell from "../components/AuthenticatedShell";
import LocationPicker from "../components/LocationPicker";
import { syncCurrentUser, useCurrentUser } from "../services/authService";
import { createOrganizationProfile, getOrganizationProfile } from "../services/platformService";
import "../styles/Portal.css";
import "../styles/Registration.css";

const initialForm = {
  name: "",
  description: "",
  image: null as File | null,
  latitude: 0,
  longitude: 0,
  address: "",
  city: "",
  capacity: 0,
  radius: 0,
  phone_number: "",
  contact_email: "",
  bank_name: "",
  bank_account_title: "",
  bank_account_number: "",
  tax_id: "",
  payment_notes: "",
  supply_goal_pkr: 100000,
};

type FormState = typeof initialForm;

const STEPS = [
  { title: "Organization Basics", copy: "Tell people who you are and what your rescue does." },
  { title: "Location", copy: "Pin your base so nearby cases can find you." },
  { title: "Capacity & Contact", copy: "How much you can take on, and how to reach you." },
  { title: "Donation Details", copy: "Optional bank details shown on animal and adoption profiles." },
  { title: "Review & Submit", copy: "Confirm everything looks right before you save." },
];

function validateStep(step: number, form: FormState): string | null {
  if (step === 0 && !form.name.trim()) {
    return "Organization name is required.";
  }
  if (step === 1 && !form.address.trim()) {
    return "Add an address or drop a pin on the map.";
  }
  if (step === 2 && (!form.phone_number.trim() || !form.contact_email.trim())) {
    return "Phone and contact email are required.";
  }
  return null;
}

function OrganizationRegistration() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(initialForm);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState(false);

  useEffect(() => {
    // Only checks whether this account already has a team (then it's sent to Edit profile).
    getOrganizationProfile()
      .then(() => setHasProfile(true))
      .catch(() => setHasProfile(false))
      .finally(() => setProfileLoaded(true));
  }, []);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!form.image) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(form.image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  const buildPayload = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  const goToStep = (target: number) => {
    if (target < step) {
      setStepError(null);
      setStep(target);
      return;
    }

    for (let i = step; i < target; i += 1) {
      const error = validateStep(i, form);
      if (error) {
        setStep(i);
        setStepError(error);
        return;
      }
    }

    setStepError(null);
    setStep(target);
  };

  const handleNext = () => {
    const error = validateStep(step, form);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const submitProfile = async () => {
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      const error = validateStep(i, form);
      if (error) {
        setStep(i);
        setStepError(error);
        return;
      }
    }
    if (!hasProfile && !confirmedDetails) {
      setStepError("Confirm you're allowed to register this team and that the details are true.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();

      const profile = await createOrganizationProfile(payload);
      await syncCurrentUser();
      setExistingImage(profile.image ?? null);
      alert("Organization profile created");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error(error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response
          ? JSON.stringify(error.response.data)
          : "Could not save organization profile";
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitProfile();
  };

  const handlePrimaryClick = () => {
    if (isLastStep) {
      submitProfile();
    } else {
      handleNext();
    }
  };

  const wizardContent = (
    <div className="portal-page wizard-page">
      <div className="portal-header">
        <div>
          <h1>Register your rescue team</h1>
          <p>Five short steps. Once you're done, nearby reports reach you and people can follow, sponsor and adopt through your page.</p>
        </div>
      </div>

      <div className="wizard-stepper">
        {STEPS.map((item, index) => {
          const isComplete = index < step;
          const isActive = index === step;
          return (
            <div className="wizard-step" key={item.title}>
              <button
                type="button"
                className={`wizard-step-dot${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                onClick={() => goToStep(index)}
                aria-label={`Go to step ${index + 1}: ${item.title}`}
              >
                {isComplete ? <Check size={16} /> : index + 1}
              </button>
              <span className={`wizard-step-label${isActive ? " is-active" : ""}`}>{item.title}</span>
              {index < STEPS.length - 1 ? <span className={`wizard-step-line${isComplete ? " is-complete" : ""}`} /> : null}
            </div>
          );
        })}
      </div>

      <form className="panel-card portal-form wizard-card" onSubmit={handleFormSubmit}>
        <div className="wizard-step-heading">
          <h2>{STEPS[step].title}</h2>
          <p className="meta-line">{STEPS[step].copy}</p>
        </div>

        {step === 0 ? (
          <div className="wizard-step-body">
            <div className="portal-form-grid">
              <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <div className="wizard-logo-field">
                <span>Logo or photo</span>
                <div className="wizard-logo-row">
                  <span className="wizard-logo-preview">
                    {imagePreviewUrl || existingImage ? <img src={imagePreviewUrl ?? existingImage ?? ""} alt="" /> : <UploadCloud size={20} />}
                  </span>
                  <label className="secondary-btn upload-btn">
                    {imagePreviewUrl || existingImage ? "Change image" : "Upload image"}
                    <input className="sr-only" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
                  </label>
                </div>
              </div>
            </div>

            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-step-body">
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              address={form.address}
              onLocationChange={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude }))}
              onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
            />
            <div className="portal-form-grid">
              <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-step-body">
            <div className="portal-form-grid">
              <label>
                Capacity
                <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) || 0 })} />
              </label>
              <label>
                Service Radius (km)
                <input type="number" min="0" step="0.1" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) || 0 })} />
              </label>
              <label>Phone<input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required /></label>
              <label>Contact Email<input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} required /></label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-step-body">
            <p className="meta-line">These details will appear on animal profiles and post donation panels. You can leave this blank and add it later.</p>
            <div className="portal-form-grid">
              <label>
                Bank
                <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </label>
              <label>
                Account Name
                <input value={form.bank_account_title} onChange={(e) => setForm({ ...form, bank_account_title: e.target.value })} />
              </label>
              <label>
                Account Number
                <input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
              </label>
              <label>
                Monthly Supply Goal (Rs)
                <input type="number" min="0" step="1000" value={form.supply_goal_pkr} onChange={(e) => setForm({ ...form, supply_goal_pkr: Number(e.target.value) })} />
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-step-body">
            <div className="wizard-review-grid">
              <div className="wizard-review-item"><span>Name</span><strong>{form.name || "—"}</strong></div>
              <div className="wizard-review-item"><span>Description</span><strong>{form.description || "—"}</strong></div>
              <div className="wizard-review-item"><span>Address</span><strong>{form.address || "—"}</strong></div>
              <div className="wizard-review-item"><span>City</span><strong>{form.city || "—"}</strong></div>
              <div className="wizard-review-item"><span>Capacity</span><strong>{form.capacity || "—"}</strong></div>
              <div className="wizard-review-item"><span>Service Radius</span><strong>{form.radius ? `${form.radius} km` : "—"}</strong></div>
              <div className="wizard-review-item"><span>Phone</span><strong>{form.phone_number || "—"}</strong></div>
              <div className="wizard-review-item"><span>Contact Email</span><strong>{form.contact_email || "—"}</strong></div>
              <div className="wizard-review-item"><span>Bank</span><strong>{form.bank_name || "Not provided"}</strong></div>
              <div className="wizard-review-item"><span>Account Name</span><strong>{form.bank_account_title || "Not provided"}</strong></div>
              <div className="wizard-review-item"><span>Account Number</span><strong>{form.bank_account_number || "Not provided"}</strong></div>
            </div>
            {!hasProfile ? (
              <label className="check wizard-confirm">
                <input type="checkbox" checked={confirmedDetails} onChange={(event) => { setConfirmedDetails(event.target.checked); setStepError(null); }} />
                <span>
                  I'm allowed to register {form.name || "this team"}, these details are true, and I agree to the{" "}
                  <Link to="/legal/terms" target="_blank">Terms of Service</Link>.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {stepError ? <p className="wizard-step-error" role="alert">{stepError}</p> : null}

        <div className="portal-actions wizard-actions">
          {step > 0 ? <button type="button" className="secondary-btn" onClick={handleBack}>Back</button> : <span />}
          <button type="button" className="primary-btn" onClick={handlePrimaryClick} disabled={submitting}>
            {isLastStep ? (submitting ? "Saving..." : hasProfile ? "Update Profile" : "Create Profile") : "Next"}
          </button>
        </div>
      </form>
    </div>
  );

  let pageContent = wizardContent;
  if (!profileLoaded) {
    pageContent = <div className="empty-state">Loading your organization profile...</div>;
  } else if (hasProfile) {
    // Teams that already exist edit their profile from the menu on their public page.
    return <Navigate to="/organization/edit" replace />;
  }

  if (currentUser) {
    return (
      <AuthenticatedShell>
          {pageContent}
      </AuthenticatedShell>
    );
  }

  return pageContent;
}

export default OrganizationRegistration;
