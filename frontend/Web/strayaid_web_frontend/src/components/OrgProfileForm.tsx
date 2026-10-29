import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Circle, CircleMarker, MapContainer, useMap, useMapEvents } from "react-leaflet";
import MapTiles from "./map/MapTiles";
import { areaPathOptions, basePathOptions } from "./map/mapStyle";
import { Crosshair, ImagePlus } from "lucide-react";
import { createOrganizationProfile, updateOrganizationProfile } from "../services/platformService";
import { errorMessage } from "../utils/errors";
import type { Organization } from "../types/platform";
import "./OrgProfileForm.css";

const ISLAMABAD: [number, number] = [33.6844, 73.0479];

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center]);
  return null;
}

/** Click the map (or use your location) to set where the team is based. */
function LocationField({ latitude, longitude, radius, onChange }: { latitude: number | null; longitude: number | null; radius: number; onChange: (lat: number, lng: number) => void }) {
  const [locating, setLocating] = useState(false);
  const placed = latitude !== null && longitude !== null;
  const center: [number, number] = placed ? [latitude, longitude] : ISLAMABAD;

  const useMine = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(Number(position.coords.latitude.toFixed(6)), Number(position.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => setLocating(false),
    );
  };

  return (
    <div className="field">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="field-label">Base location</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={useMine} disabled={locating}>
          <Crosshair size={14} /> {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <div className="org-location-map">
        <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "100%" }}>
          <MapTiles />
          <ClickToPlace onPick={(lat, lng) => onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)))} />
          {placed ? (
            <>
              <Recenter center={center} />
              <Circle center={center} radius={radius * 1000} pathOptions={areaPathOptions} />
              <CircleMarker center={center} radius={8} pathOptions={basePathOptions()} />
            </>
          ) : null}
        </MapContainer>
      </div>
      <span className="field-hint">
        {placed ? "You get cases inside the green circle. Click the map to move your base." : "Click the map where your team is based."}
      </span>
    </div>
  );
}

/** One settings group: what it's for on the left, its fields on the right. */
function FormSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="org-form-section" aria-labelledby={`${id}-title`}>
      <div className="org-form-intro">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="org-form-fields">{children}</div>
    </section>
  );
}

type FormState = {
  name: string;
  description: string;
  phone_number: string;
  contact_email: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  radius: number;
  capacity: string;
  bank_name: string;
  bank_account_title: string;
  bank_account_number: string;
  tax_id: string;
  payment_notes: string;
  supply_goal_pkr: string;
};

const toForm = (organization?: Organization | null): FormState => ({
  name: organization?.name ?? "",
  description: organization?.description ?? "",
  phone_number: organization?.phone_number ?? "",
  contact_email: organization?.contact_email ?? "",
  address: organization?.address ?? "",
  city: organization?.city ?? "",
  latitude: organization?.latitude ?? null,
  longitude: organization?.longitude ?? null,
  radius: organization?.radius ?? 10,
  capacity: String(organization?.capacity ?? 20),
  bank_name: organization?.bank_name ?? "",
  bank_account_title: organization?.bank_account_title ?? "",
  bank_account_number: organization?.bank_account_number ?? "",
  tax_id: organization?.tax_id ?? "",
  payment_notes: organization?.payment_notes ?? "",
  supply_goal_pkr: String(organization?.supply_goal_pkr ?? 100000),
});

/**
 * The organization profile: who you are, how to reach you, where you work (service area and
 * capacity, which decide which cases you can accept) and the bank details supporters use.
 */
function OrgProfileForm({ organization, onSaved, submitLabel = "Save changes" }: {
  organization?: Organization | null;
  onSaved: (organization: Organization) => void;
  submitLabel?: string;
}) {
  const [saved, setSaved] = useState<FormState>(() => toForm(organization));
  const [form, setForm] = useState<FormState>(saved);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(organization?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const dirty = useMemo(() => image !== null || JSON.stringify(form) !== JSON.stringify(saved), [form, saved, image]);

  const discard = () => {
    setForm(saved);
    setImage(null);
    setPreview(organization?.image ?? null);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.latitude === null || form.longitude === null) {
      setError("Set your base location on the map, so we can send you nearby cases.");
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, String(value ?? "")));
    if (image) data.append("image", image);
    setSaving(true);
    try {
      const result = organization ? await updateOrganizationProfile(data) : await createOrganizationProfile(data);
      setSaved(form);
      setImage(null);
      onSaved(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="org-form" onSubmit={submit}>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <FormSection id="org-public" title="Public profile" description="Your logo, name and story. Shown on your page, your posts and your animals' profiles.">
        <div className="org-logo-field">
          <div className="animal-photo-preview">{preview ? <img src={preview} alt="" /> : <ImagePlus size={24} />}</div>
          <div className="field">
            <label className="btn btn-secondary btn-sm upload-btn">
              <ImagePlus size={15} /> {preview ? "Change logo" : "Upload logo"}
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setImage(file);
                  if (file) setPreview(URL.createObjectURL(file));
                }}
              />
            </label>
            <span className="field-hint">{image ? image.name : "Square PNG or JPG, under 2 MB."}</span>
          </div>
        </div>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" required value={form.name} onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">About</span>
          <textarea className="textarea" rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="What you do and which animals you help." />
          <span className="field-hint">The first sentence becomes the tagline under your name.</span>
        </label>
      </FormSection>

      <FormSection id="org-contact" title="Contact" description="How reporters, adopters and supporters reach you.">
        <div className="org-form-pair">
          <label className="field">
            <span className="field-label">Phone</span>
            <input className="input" type="tel" required value={form.phone_number} onChange={(event) => set("phone_number", event.target.value)} placeholder="+92 300 1234567" />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} />
          </label>
        </div>
      </FormSection>

      <FormSection id="org-area" title="Service area" description="You only receive and accept cases inside your radius, and only while you have room.">
        <div className="org-form-pair">
          <label className="field">
            <span className="field-label">Address</span>
            <input className="input" required value={form.address} onChange={(event) => set("address", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input className="input" value={form.city} onChange={(event) => set("city", event.target.value)} />
          </label>
        </div>
        <LocationField latitude={form.latitude} longitude={form.longitude} radius={form.radius} onChange={(lat, lng) => setForm((current) => ({ ...current, latitude: lat, longitude: lng }))} />
        <div className="org-form-pair">
          <label className="field">
            <span className="field-label">Service radius: {form.radius} km</span>
            <input type="range" min={1} max={50} value={form.radius} onChange={(event) => set("radius", Number(event.target.value))} aria-label="Service radius in km" />
          </label>
          <label className="field">
            <span className="field-label">Capacity (animals at once)</span>
            <input className="input" type="number" min={1} max={1000} value={form.capacity} onChange={(event) => set("capacity", event.target.value)} />
          </label>
        </div>
      </FormSection>

      <FormSection id="org-donations" title="Donations" description="Where supporters send money for your animals and supplies. StrayAid shows these details as written, so double-check them.">
        <div className="org-form-pair">
          <label className="field">
            <span className="field-label">Bank</span>
            <input className="input" value={form.bank_name} onChange={(event) => set("bank_name", event.target.value)} placeholder="e.g. Meezan Bank" />
          </label>
          <label className="field">
            <span className="field-label">Account title</span>
            <input className="input" value={form.bank_account_title} onChange={(event) => set("bank_account_title", event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Account number / IBAN</span>
          <input className="input" value={form.bank_account_number} onChange={(event) => set("bank_account_number", event.target.value)} placeholder="PK00 XXXX 0000 0000 0000 0000" />
        </label>
        <div className="org-form-pair">
          <label className="field">
            <span className="field-label">Monthly supply goal (Rs)</span>
            <input className="input" type="number" min={0} step={1000} value={form.supply_goal_pkr} onChange={(event) => set("supply_goal_pkr", event.target.value)} />
            <span className="field-hint">This month's target for medicine, bandages and food.</span>
          </label>
          <label className="field">
            <span className="field-label">Tax / registration ID <span className="muted">(optional)</span></span>
            <input className="input" value={form.tax_id} onChange={(event) => set("tax_id", event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Note for supporters <span className="muted">(optional)</span></span>
          <input className="input" value={form.payment_notes} onChange={(event) => set("payment_notes", event.target.value)} placeholder="e.g. Add your name in the transfer reference." />
        </label>
      </FormSection>

      <div className="org-form-actions">
        <span className="org-form-status">
          <span className={`org-form-dot${dirty ? " is-dirty" : ""}`} aria-hidden="true" />
          {dirty ? "You have unsaved changes" : "All changes saved"}
        </span>
        <div className="row">
          {organization ? <button type="button" className="btn btn-ghost" onClick={discard} disabled={!dirty || saving}>Discard</button> : null}
          <button type="submit" className="btn btn-primary" disabled={saving || (Boolean(organization) && !dirty)}>{saving ? "Saving…" : submitLabel}</button>
        </div>
      </div>
    </form>
  );
}

export default OrgProfileForm;
