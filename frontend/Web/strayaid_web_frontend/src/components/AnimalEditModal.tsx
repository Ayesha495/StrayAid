import { useEffect, useRef, useState } from "react";
import { IdCard, PawPrint, Save, UploadCloud, X } from "lucide-react";
import SafeImage from "./SafeImage";
import { updateAnimal } from "../services/platformService";
import type { Animal } from "../types/platform";
import { caseLabel } from "../utils/identifiers";
import "../styles/Portal.css";
import "../styles/AnimalManagement.css";

type AnimalEditModalProps = {
  animal: Animal;
  onClose: () => void;
  onSaved: (animal: Animal) => void;
};

const STATUS_OPTIONS = [
  { value: "rescued", label: "Rescued" },
  { value: "recovering", label: "Recovering" },
  { value: "adoptable", label: "Adoptable" },
  { value: "adopted", label: "Adopted" },
];

function getSaveErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
  if (!data) {
    return "Could not save changes. Please try again.";
  }

  const first = Object.values(data).find(Boolean);
  const message = Array.isArray(first) ? first[0] : first;
  return typeof message === "string" && message ? message : "Could not save changes. Please check your input.";
}

// Mounted only while open (the parent renders it conditionally, keyed by animal),
// so the form can start from the animal's current values without an effect.
function AnimalEditModal({ animal, onClose, onSaved }: AnimalEditModalProps) {
  const [form, setForm] = useState({
    name: animal.name ?? "",
    breed: animal.breed ?? "",
    species: animal.species ?? "",
    gender: animal.gender ?? "",
    age: animal.age != null ? String(animal.age) : "",
    color: animal.color ?? "",
    microchip_id: animal.microchip_id ?? "",
    description: animal.description ?? "",
    medical_info: animal.medical_info ?? "",
    status: animal.status || "rescued",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(animal.image);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const setField = (name: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    // Reset so picking the same file again still fires onChange.
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPG).");
      return;
    }
    setError("");
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = URL.createObjectURL(file);
    setImageFile(file);
    setPreviewUrl(objectUrlRef.current);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Animal name is required.");
      return;
    }

    // Empty strings are sent on purpose so a field can be cleared.
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, key === "name" ? value.trim() : value));
    if (imageFile) {
      payload.append("image", imageFile);
    }

    setIsSaving(true);
    setError("");
    try {
      const updated = await updateAnimal(animal.id, payload);
      onSaved(updated);
    } catch (saveError) {
      console.error(saveError);
      setError(getSaveErrorMessage(saveError));
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop am-edit-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card am-edit-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="animal-edit-title"
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Edit Profile &middot; {caseLabel(animal.case_id)}</p>
            <h2 id="animal-edit-title">{animal.name}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close edit profile">
            <X size={18} />
          </button>
        </div>

        <form className="am-form" onSubmit={handleSubmit}>
          {error ? <p className="wizard-step-error" role="alert">{error}</p> : null}

          <div className="am-field">
            <span className="am-field-label">Animal Photo</span>
            <div className="am-photo-field">
              <div className="am-photo-thumb">
                <SafeImage
                  key={previewUrl ?? "none"}
                  src={previewUrl}
                  alt={`${form.name || "Animal"} photo`}
                  fallback={<PawPrint size={28} />}
                  fallbackClassName="am-photo-empty"
                />
              </div>
              <div className="am-photo-meta">
                <label className="btn btn-secondary btn-sm am-photo-button">
                  <UploadCloud size={15} /> {previewUrl ? "Change Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="am-file-input"
                    onChange={handleImageChange}
                    aria-label="Upload animal photo"
                  />
                </label>
                {imageFile ? (
                  <span className="am-photo-status">New photo selected: {imageFile.name}. It is saved when you click Save Changes.</span>
                ) : (
                  <span className="am-field-hint">PNG or JPG, clear and well-lit.</span>
                )}
              </div>
            </div>
          </div>

          <div className="am-edit-grid">
            <label className="am-field">
              <span className="am-field-label">Animal Name <span className="am-required">*</span></span>
              <input value={form.name} onChange={(e) => setField("name", e.target.value)} required autoFocus />
            </label>
            <label className="am-field">
              <span className="am-field-label">Shelter Care Status</span>
              <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="am-field">
              <span className="am-field-label">Species</span>
              <input placeholder="Dog, Cat..." value={form.species} onChange={(e) => setField("species", e.target.value)} />
            </label>
            <label className="am-field">
              <span className="am-field-label">Breed</span>
              <input value={form.breed} onChange={(e) => setField("breed", e.target.value)} />
            </label>
            <label className="am-field">
              <span className="am-field-label">Gender</span>
              <input placeholder="Male, Female..." value={form.gender} onChange={(e) => setField("gender", e.target.value)} />
            </label>
            <label className="am-field">
              <span className="am-field-label">Age (Years)</span>
              <input type="number" min="0" placeholder="e.g. 2" value={form.age} onChange={(e) => setField("age", e.target.value)} />
            </label>
            <label className="am-field">
              <span className="am-field-label">Color / Markings</span>
              <input value={form.color} onChange={(e) => setField("color", e.target.value)} />
            </label>
            <label className="am-field">
              <span className="am-field-label">Microchip / Collar Tag ID</span>
              <div className="am-input-icon">
                <IdCard size={15} />
                <input value={form.microchip_id} onChange={(e) => setField("microchip_id", e.target.value)} />
              </div>
            </label>
          </div>
          {form.status === "adopted" && animal.status !== "adopted" ? (
            <p className="am-field-hint">Marking an animal as adopted closes its linked rescue case.</p>
          ) : null}

          <label className="am-field">
            <span className="am-field-label">Public Adoption Description</span>
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} />
          </label>

          <label className="am-field">
            <span className="am-field-label">Clinical &amp; Medical Info</span>
            <textarea value={form.medical_info} onChange={(e) => setField("medical_info", e.target.value)} />
            <span className="am-field-hint">Vaccinations, spay/neuter, allergy details.</span>
          </label>

          <div className="portal-actions">
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>
              <Save size={15} /> {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AnimalEditModal;
