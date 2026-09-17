import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, Check, Eye, Landmark, Mail, MapPinned, Phone, ShieldAlert, SquareUserRound, UploadCloud } from "lucide-react";
import AuthenticatedShell from "../components/AuthenticatedShell";
import LocationPicker from "../components/LocationPicker";
import { syncCurrentUser, useCurrentUser } from "../services/authSevice";
import { createOrganizationProfile, getOrganizationProfile, updateOrganizationProfile } from "../services/platformService";
import "../styles/Portal.css";
import "../styles/Registration.css";
import "../styles/Profile.css";

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
  const [originalForm, setOriginalForm] = useState<FormState | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getOrganizationProfile()
      .then((profile) => {
        const loadedForm: FormState = {
          name: profile.name,
          description: profile.description,
          image: null,
          latitude: profile.latitude,
          longitude: profile.longitude,
          address: profile.address,
          city: profile.city ?? "",
          capacity: profile.capacity ?? 0,
          radius: profile.radius ?? 0,
          phone_number: profile.phone_number,
          contact_email: profile.contact_email,
          bank_name: profile.bank_name ?? "",
          bank_account_title: profile.bank_account_title ?? "",
          bank_account_number: profile.bank_account_number ?? "",
          tax_id: profile.tax_id ?? "",
          payment_notes: profile.payment_notes ?? "",
        };
        setForm(loadedForm);
        setOriginalForm(loadedForm);
        setExistingImage(profile.image ?? null);
        setOrgId(profile.id);
        setIsVerified(Boolean(profile.is_verified));
        setHasProfile(true);
      })
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

  const handleDiscard = () => {
    if (originalForm) {
      setForm(originalForm);
    }
    setStepError(null);
  };

  const isDirty = originalForm ? JSON.stringify({ ...form, image: null }) !== JSON.stringify({ ...originalForm, image: null }) || form.image !== null : false;

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

    setSubmitting(true);
    try {
      const payload = buildPayload();

      if (hasProfile) {
        const profile = await updateOrganizationProfile(payload);
        await syncCurrentUser();
        setExistingImage(profile.image ?? null);
        setIsVerified(Boolean(profile.is_verified));
        setForm((current) => {
          const next = { ...current, image: null };
          setOriginalForm(next);
          return next;
        });
        alert("Organization profile updated");
      } else {
        const profile = await createOrganizationProfile(payload);
        await syncCurrentUser();
        setExistingImage(profile.image ?? null);
        alert("Organization profile created");
        setHasProfile(true);
        navigate("/dashboard", { replace: true });
      }
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
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Organization Registration</h1>
          <p>Set your rescue identity, service range, donation information, and public image so people understand who you are and how you help.</p>
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
              <label>
                Organization Image
                <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
              </label>
            </div>
            {existingImage ? (
              <div className="panel-card compact-state">
                <strong>Current Public Image</strong>
                <img className="detail-hero-image" src={existingImage} alt={form.name || "Organization"} />
              </div>
            ) : null}
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
          </div>
        ) : null}

        {stepError ? <p className="wizard-step-error">{stepError}</p> : null}

        <div className="portal-actions wizard-actions">
          {step > 0 ? <button type="button" className="secondary-btn" onClick={handleBack}>Back</button> : <span />}
          <button type="button" className="primary-btn" onClick={handlePrimaryClick} disabled={submitting}>
            {isLastStep ? (submitting ? "Saving..." : hasProfile ? "Update Profile" : "Create Profile") : "Next"}
          </button>
        </div>
      </form>
    </div>
  );

  const initials = (form.name || "Org").trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "OR";

  const editContent = (
    <div className="portal-page profile-page">
      <div className="portal-header">
        <div>
          <h1 className="profile-title-row">
            Organization Profile
            {isVerified ? <span className="badge badge-green profile-verified-pill"><BadgeCheck size={12} /> Verified</span> : null}
          </h1>
          <p>Update your rescue identity, operational service range, verified banking information, and public transparency profile.</p>
        </div>
        <div className="profile-header-actions">
          {orgId ? (
            <Link className="overview-btn-outline" to={`/organizations/${orgId}`} target="_blank" rel="noreferrer">
              <Eye size={16} /> Preview Public Hub
            </Link>
          ) : null}
          <button type="button" className="overview-btn-filled" onClick={submitProfile} disabled={submitting}>
            <Check size={16} /> {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleFormSubmit}>
        <section className="panel-card profile-section">
          <div className="profile-section-heading">
            <span className="profile-section-icon"><SquareUserRound size={16} /></span>
            <div>
              <h2>Basic Rescue Identity &amp; Public Presence</h2>
              <p className="meta-line">This info is prominently displayed on animal adoption cards, public alerts, and rescue reports.</p>
            </div>
          </div>

          <div className="profile-field-grid">
            <label className="profile-field">
              <span className="profile-field-label">Organization Legal / Operating Name <span className="profile-required">*</span></span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <span className="profile-field-hint">Registered non-profit or community rescue team title.</span>
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Organization Badge</span>
              <div className="profile-badge-upload">
                <span className="profile-badge-preview">{initials}</span>
                <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
              </div>
              <span className="profile-field-hint">Preview generated from your organization name. PNG or JPG, under 2MB.</span>
            </label>
          </div>

          <div className="profile-cover-block">
            <div className="profile-field-label-row">
              <span className="profile-field-label">Current Public Cover Image</span>
            </div>
            {existingImage || imagePreviewUrl ? (
              <div className="profile-cover-image">
                <img src={imagePreviewUrl ?? existingImage ?? ""} alt={form.name || "Organization"} />
                <span className="profile-cover-tag">Public Cover</span>
                <label className="profile-cover-change">
                  Change File
                  <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} hidden />
                </label>
              </div>
            ) : (
              <label className="profile-cover-empty">
                <UploadCloud size={20} />
                <span>Upload a cover image</span>
                <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} hidden />
              </label>
            )}
            <span className="profile-field-hint">Displayed at the top of your public donation campaigns &amp; rescue cases.</span>
          </div>

          <label className="profile-field">
            <span className="profile-field-label">About &amp; Mission Statement</span>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <span className="profile-field-hint">Brief summary of your organization shown on case detail pages and community inquiries.</span>
          </label>
        </section>

        <section className="panel-card profile-section">
          <div className="profile-section-heading">
            <span className="profile-section-icon"><MapPinned size={16} /></span>
            <div>
              <h2>Organization Location &amp; Dispatch Coverage</h2>
              <p className="meta-line">Pin your rescue facility on the map or sync with your GPS coordinates.</p>
            </div>
          </div>

          <LocationPicker
            hideHeader
            latitude={form.latitude}
            longitude={form.longitude}
            address={form.address}
            onLocationChange={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude }))}
            onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
          />

          <div className="profile-field-grid profile-field-grid-3">
            <label className="profile-field">
              <span className="profile-field-label">Operating City</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Shelter Intake Capacity</span>
              <div className="profile-input-suffix">
                <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) || 0 })} />
                <span>kennels/slots</span>
              </div>
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Service Radius (km)</span>
              <div className="profile-input-suffix">
                <input type="number" min="0" step="0.1" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) || 0 })} />
                <span>kilometers</span>
              </div>
            </label>
          </div>

          <div className="profile-field-grid">
            <label className="profile-field">
              <span className="profile-field-label">Rescue Hotline / Phone Number <span className="profile-required">*</span></span>
              <div className="profile-input-icon">
                <Phone size={15} />
                <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} required />
              </div>
              <span className="profile-field-hint">Urgent dispatcher contact line for emergency incident calls.</span>
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Official Contact Email <span className="profile-required">*</span></span>
              <div className="profile-input-icon">
                <Mail size={15} />
                <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} required />
              </div>
              <span className="profile-field-hint">Verification badges and official receipts are dispatched here.</span>
            </label>
          </div>
        </section>

        <section className="panel-card profile-section">
          <div className="profile-section-heading">
            <span className="profile-section-icon"><Landmark size={16} /></span>
            <div>
              <h2>Donation &amp; Direct Sponsorship Channel</h2>
              <p className="meta-line">These verified banking and payment details appear on animal case profiles and medical sponsorship panels.</p>
            </div>
          </div>

          <div className="profile-notice">
            <ShieldAlert size={18} />
            <div>
              <strong>Security &amp; Audit Compliance Notice</strong>
              <p>To prevent fraud in animal charity sponsorships, updates to account numbers undergo review before syncing with public donation panels.</p>
            </div>
          </div>

          <div className="profile-field-grid">
            <label className="profile-field">
              <span className="profile-field-label">Bank / Provider Name</span>
              <input placeholder="e.g. Standard Chartered / Meezan Bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Account Name / Title</span>
              <input placeholder="e.g. Rescue Op Animal Welfare Trust" value={form.bank_account_title} onChange={(e) => setForm({ ...form, bank_account_title: e.target.value })} />
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Account Number / IBAN</span>
              <input placeholder="PK00 XXXX 0000 0000 0000 0000" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
            </label>
          </div>

          <div className="profile-field-grid">
            <label className="profile-field">
              <span className="profile-field-label">Non-Profit Tax ID / Registration # <span className="profile-optional">(Optional)</span></span>
              <input placeholder="REG-NGO-2023-889" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
              <span className="profile-field-hint">Enables the tax-deductible donation badge on animal profiles.</span>
            </label>
            <label className="profile-field">
              <span className="profile-field-label">Payment Reference Notes <span className="profile-optional">(Optional)</span></span>
              <input placeholder="Mention 'Animal ID' in bank transfer remarks" value={form.payment_notes} onChange={(e) => setForm({ ...form, payment_notes: e.target.value })} />
              <span className="profile-field-hint">Instruction displayed under the donor modal.</span>
            </label>
          </div>
        </section>

        {stepError ? <p className="wizard-step-error">{stepError}</p> : null}

        <div className="profile-save-bar">
          <span className="profile-save-status">
            <span className={`profile-save-dot${isDirty ? " is-dirty" : ""}`} />
            {isDirty ? "You have unsaved changes." : "Your profile is up to date."}
          </span>
          <div className="profile-save-actions">
            <button type="button" className="secondary-btn" onClick={handleDiscard} disabled={!isDirty}>Discard Changes</button>
            <button type="submit" className="overview-btn-filled" disabled={submitting}>
              <UploadCloud size={16} /> {submitting ? "Saving..." : "Update Profile"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  let pageContent = wizardContent;
  if (!profileLoaded) {
    pageContent = <div className="empty-state">Loading your organization profile...</div>;
  } else if (hasProfile) {
    pageContent = editContent;
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
