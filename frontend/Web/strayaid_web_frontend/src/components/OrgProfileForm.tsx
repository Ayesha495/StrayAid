import { useEffect, useState } from "react";
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
        {placed ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}. You get cases inside the green circle.` : "Click the map where your team is based."}
      </span>
    </div>
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

/**
 * The organization profile: who you are, where you work (service area and capacity, which
 * decide which cases you can accept) and the bank details supporters transfer to.
 */
function OrgProfileForm({ organization, onSaved, submitLabel = "Save changes" }: {
  organization?: Organization | null;
  onSaved: (organization: Organization) => void;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<FormState>({
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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(organization?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

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
      const saved = organization ? await updateOrganizationProfile(data) : await createOrganizationProfile(data);
      onSaved(saved);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="org-form" onSubmit={submit}>
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <section className="card">
        <div className="card-header"><h3>About your organization</h3></div>
        <div className="card-body form-grid">
          <div className="span-2 animal-photo-field">
            <div className="animal-photo-preview">{preview ? <img src={preview} alt="" /> : <ImagePlus size={24} />}</div>
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Logo</span>
              <label className="btn btn-secondary upload-btn">
                <ImagePlus size={16} /> {preview ? "Change logo" : "Upload logo"}
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
              <span className="field-hint">{image ? image.name : "A square PNG or JPG works best. It shows on your public page and posts."}</span>
            </div>
          </div>
          <label className="field span-2">
            <span className="field-label">Name</span>
            <input className="input" required value={form.name} onChange={(event) => set("name", event.target.value)} />
          </label>
          <label className="field span-2">
            <span className="field-label">Description</span>
            <textarea className="textarea" value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="What you do and which animals you help." />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input className="input" type="tel" required value={form.phone_number} onChange={(event) => set("phone_number", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Contact email</span>
            <input className="input" type="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Service area</h3>
            <p className="small muted">You can only accept cases inside your radius, up to your capacity.</p>
          </div>
        </div>
        <div className="card-body form-grid">
          <label className="field">
            <span className="field-label">Address</span>
            <input className="input" required value={form.address} onChange={(event) => set("address", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">City</span>
            <input className="input" value={form.city} onChange={(event) => set("city", event.target.value)} />
          </label>
          <div className="span-2">
            <LocationField latitude={form.latitude} longitude={form.longitude} radius={form.radius} onChange={(lat, lng) => setForm((current) => ({ ...current, latitude: lat, longitude: lng }))} />
          </div>
          <label className="field">
            <span className="field-label">Service radius: {form.radius} km</span>
            <input type="range" min={1} max={50} value={form.radius} onChange={(event) => set("radius", Number(event.target.value))} aria-label="Service radius in km" />
          </label>
          <label className="field">
            <span className="field-label">Capacity (animals at once)</span>
            <input className="input" type="number" min={1} max={1000} value={form.capacity} onChange={(event) => set("capacity", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Bank details</h3>
            <p className="small muted">Shown to people who sponsor your animals or give to your supplies.</p>
          </div>
        </div>
        <div className="card-body form-grid">
          <label className="field">
            <span className="field-label">Bank</span>
            <input className="input" value={form.bank_name} onChange={(event) => set("bank_name", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Account title</span>
            <input className="input" value={form.bank_account_title} onChange={(event) => set("bank_account_title", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Account number / IBAN</span>
            <input className="input" value={form.bank_account_number} onChange={(event) => set("bank_account_number", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Tax / registration ID</span>
            <input className="input" value={form.tax_id} onChange={(event) => set("tax_id", event.target.value)} />
          </label>
          <label className="field span-2">
            <span className="field-label">Monthly medical supply goal (Rs)</span>
            <input className="input" type="number" min={0} step={1000} value={form.supply_goal_pkr} onChange={(event) => set("supply_goal_pkr", event.target.value)} />
            <span className="field-hint">Shown on your public page as this month's target for medicine, bandages and food.</span>
          </label>
          <label className="field span-2">
            <span className="field-label">Notes for supporters</span>
            <textarea className="textarea" rows={2} value={form.payment_notes} onChange={(event) => set("payment_notes", event.target.value)} placeholder="e.g. Add your name in the transfer reference." />
          </label>
        </div>
      </section>

      <div className="org-form-actions">
        <span className="small muted">Changes show on your public profile straight away.</span>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

export default OrgProfileForm;
