import { useState } from "react";
import { ImagePlus } from "lucide-react";
import Modal from "../ui/Modal";
import Combobox from "../ui/Combobox";
import { breedsFor } from "../data/breeds";
import { createAnimal, createMedicalRecord, updateAnimal, updateMedicalRecord } from "../services/platformService";
import { HEALTH, MEDICAL_KINDS, medicalKind, today, type StatusMove } from "../utils/animals";
import { caseReference, caseTitle } from "../utils/cases";
import { capitalize } from "../utils/format";
import { errorMessage } from "../utils/errors";
import type { Animal, Case, MedicalRecord } from "../types/platform";
import "./AnimalForms.css";

/** Save button state and the error line every form here shares. */
function useSubmit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (save: () => Promise<void>) => {
    setError(null);
    setSaving(true);
    try {
      await save();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };
  return { saving, error, run };
}

function HealthFields({ health, vaccinated, sterilized, onChange }: {
  health: string;
  vaccinated: boolean;
  sterilized: boolean;
  onChange: (change: { health?: string; vaccinated?: boolean; sterilized?: boolean }) => void;
}) {
  return (
    <>
      <label className="field">
        <span className="field-label">Health status</span>
        <select className="select" value={health} onChange={(event) => onChange({ health: event.target.value })}>
          <option value="">Not assessed yet</option>
          {Object.entries(HEALTH).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      <div className="animal-form-checks">
        <label className="check">
          <input type="checkbox" checked={vaccinated} onChange={(event) => onChange({ vaccinated: event.target.checked })} /> Vaccinated
        </label>
        <label className="check">
          <input type="checkbox" checked={sterilized} onChange={(event) => onChange({ sterilized: event.target.checked })} /> Spayed or neutered
        </label>
      </div>
    </>
  );
}

const GENDERS = ["Female", "Male", "Unknown"];

const emptyProfile = {
  case: "",
  name: "",
  species: "",
  breed: "",
  gender: "",
  age: "",
  color: "",
  microchip_id: "",
  description: "",
  // Only asked for a new animal; afterwards each has its own place on the record.
  status: "rescued",
  health: "",
  vaccinated: false,
  sterilized: false,
  medical_info: "",
  funding_goal_pkr: "",
};

/**
 * Create an animal from a rescued case, or edit who it is. Editing sends every text field,
 * so clearing one really clears it.
 */
export function AnimalProfileForm({ animal, cases = [], initialCase = "", onClose, onSaved }: {
  animal?: Animal;
  cases?: Case[];
  initialCase?: string;
  onClose: () => void;
  onSaved: (animal: Animal) => void;
}) {
  const [form, setForm] = useState(() => ({
    ...emptyProfile,
    case: initialCase,
    ...(animal
      ? {
          name: animal.name,
          species: animal.species ?? "",
          breed: animal.breed ?? "",
          gender: capitalize((animal.gender ?? "").toLowerCase()),
          age: animal.age === null || animal.age === undefined ? "" : String(animal.age),
          color: animal.color ?? "",
          microchip_id: animal.microchip_id ?? "",
          description: animal.description ?? "",
        }
      : {}),
  }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(animal?.image ?? null);
  const { saving, error, run } = useSubmit();
  const set = (change: Partial<typeof emptyProfile>) => setForm((current) => ({ ...current, ...change }));

  const pickCase = (id: string) => {
    const picked = cases.find((item) => String(item.id) === id);
    set({ case: id, species: form.species || capitalize(picked?.species) });
  };

  const pickPhoto = (file: File | null) => {
    setPhoto(file);
    if (file) setPreview(URL.createObjectURL(file));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const data = new FormData();
      const { case: caseId, status, health, vaccinated, sterilized, medical_info, funding_goal_pkr, ...profile } = form;
      Object.entries(profile).forEach(([key, value]) => {
        if (animal || value !== "") data.append(key, value);
      });
      if (photo) data.append("image", photo);
      if (!animal) {
        data.append("case", caseId);
        data.append("status", status);
        data.append("vaccinated", String(vaccinated));
        data.append("sterilized", String(sterilized));
        if (health) data.append("health", health);
        if (medical_info) data.append("medical_info", medical_info);
        if (funding_goal_pkr) data.append("funding_goal_pkr", funding_goal_pkr);
      }
      onSaved(await (animal ? updateAnimal(animal.id, data) : createAnimal(data)));
    });
  };

  return (
    <Modal
      wide
      title={animal ? `Edit ${animal.name}'s profile` : "Add an animal"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="animal-profile-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : animal ? "Save profile" : "Create profile"}
          </button>
        </>
      }
    >
      <form id="animal-profile-form" className="stack animal-form" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {!animal ? (
          <label className="field">
            <span className="field-label">Rescued case</span>
            <select className="select" required value={form.case} onChange={(event) => pickCase(event.target.value)}>
              <option value="">Choose a case</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{caseReference(item)} · {caseTitle(item)}</option>)}
            </select>
            <span className="field-hint">Every animal comes from a rescue you marked as rescued.</span>
          </label>
        ) : null}

        <div className="animal-form-row">
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" required maxLength={255} value={form.name} onChange={(event) => set({ name: event.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Species</span>
            <select className="select" value={form.species} onChange={(event) => set({ species: event.target.value })}>
              <option value="">Choose…</option>
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className="animal-form-row">
          <Combobox
            label="Breed"
            value={form.breed}
            options={breedsFor(form.species)}
            placeholder="Search or type a breed"
            onChange={(breed) => set({ breed })}
          />
          <label className="field">
            <span className="field-label">Colour or markings</span>
            <input className="input" maxLength={100} value={form.color} onChange={(event) => set({ color: event.target.value })} />
          </label>
        </div>

        <div className="animal-form-row">
          <label className="field">
            <span className="field-label">Gender</span>
            <select className="select" value={form.gender} onChange={(event) => set({ gender: event.target.value })}>
              <option value="">Choose…</option>
              {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Age in years</span>
            <input className="input" type="number" min={0} max={40} value={form.age} onChange={(event) => set({ age: event.target.value })} />
            <span className="field-hint">An estimate is fine. Use 0 for under a year.</span>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Microchip or collar tag</span>
          <input className="input" maxLength={100} value={form.microchip_id} onChange={(event) => set({ microchip_id: event.target.value })} />
          <span className="field-hint">Only your team sees the number.</span>
        </label>

        <label className="field">
          <span className="field-label">Public description</span>
          <textarea className="textarea" value={form.description} onChange={(event) => set({ description: event.target.value })} placeholder="Personality, habits, what kind of home would suit them." />
        </label>

        {!animal ? (
          <>
            <div className="animal-form-row">
              <label className="field">
                <span className="field-label">Status today</span>
                <select className="select" value={form.status} onChange={(event) => set({ status: event.target.value })}>
                  <option value="rescued">Just rescued</option>
                  <option value="recovering">Recovering, under treatment</option>
                </select>
                <span className="field-hint">You open adoption from the animal's record once it's ready.</span>
              </label>
              <label className="field">
                <span className="field-label">Care funding goal (Rs)</span>
                <input className="input" type="number" min={0} step={500} placeholder="e.g. 15000" value={form.funding_goal_pkr} onChange={(event) => set({ funding_goal_pkr: event.target.value })} />
                <span className="field-hint">Treatment, food and shelter until adoption.</span>
              </label>
            </div>
            <HealthFields health={form.health} vaccinated={form.vaccinated} sterilized={form.sterilized} onChange={set} />
            <label className="field">
              <span className="field-label">Medical summary</span>
              <textarea className="textarea" value={form.medical_info} onChange={(event) => set({ medical_info: event.target.value })} placeholder="What adopters and sponsors should know. Shown on the public profile." />
            </label>
          </>
        ) : null}

        <div className="animal-photo-field">
          <div className="animal-photo-preview">{preview ? <img src={preview} alt="" /> : <ImagePlus size={24} aria-hidden="true" />}</div>
          <label className="field animal-form-grow">
            <span className="field-label">Photo</span>
            <input className="input" type="file" accept="image/*" onChange={(event) => pickPhoto(event.target.files?.[0] ?? null)} />
            <span className="field-hint">Clear and well lit. Adopters see this first.</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

/** The health summary adopters read, kept apart from the dated entries in the history. */
export function AnimalHealthForm({ animal, onClose, onSaved }: { animal: Animal; onClose: () => void; onSaved: (animal: Animal) => void }) {
  const [form, setForm] = useState({
    health: animal.health ?? "",
    vaccinated: Boolean(animal.vaccinated),
    sterilized: Boolean(animal.sterilized),
    medical_info: animal.medical_info ?? "",
  });
  const { saving, error, run } = useSubmit();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => onSaved(await updateAnimal(animal.id, form)));
  };

  return (
    <Modal
      title={`${animal.name}'s health`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="animal-health-form" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <form id="animal-health-form" className="stack animal-form" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <HealthFields health={form.health} vaccinated={form.vaccinated} sterilized={form.sterilized} onChange={(change) => setForm({ ...form, ...change })} />
        <label className="field">
          <span className="field-label">Medical summary</span>
          <textarea className="textarea" value={form.medical_info} onChange={(event) => setForm({ ...form, medical_info: event.target.value })} />
          <span className="field-hint">Shown on the public profile. Followers hear when this changes.</span>
        </label>
      </form>
    </Modal>
  );
}

export type MedicalDraft = Partial<Pick<MedicalRecord, "kind" | "title" | "vet">>;

/** Add or edit one dated entry in the medical history. */
export function MedicalEntryForm({ animal, record, draft, onClose, onSaved }: {
  animal: Animal;
  record?: MedicalRecord;
  /** Starts a repeat of a due follow-up. */
  draft?: MedicalDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    kind: record?.kind ?? draft?.kind ?? "checkup",
    title: record?.title ?? draft?.title ?? "",
    date: record?.date ?? today(),
    next_due: record?.next_due ?? "",
    vet: record?.vet ?? draft?.vet ?? "",
    weight_kg: record?.weight_kg ?? "",
    notes: record?.notes ?? "",
    is_public: record?.is_public ?? true,
  });
  const { saving, error, run } = useSubmit();
  const set = (change: Partial<typeof form>) => setForm((current) => ({ ...current, ...change }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const data = { ...form, animal: animal.id, next_due: form.next_due || null, weight_kg: form.weight_kg || null };
      await (record ? updateMedicalRecord(record.id, data) : createMedicalRecord(data));
      onSaved();
    });
  };

  return (
    <Modal
      title={record ? "Edit entry" : `Add to ${animal.name}'s history`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="medical-entry-form" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save entry"}</button>
        </>
      }
    >
      <form id="medical-entry-form" className="stack animal-form" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <div className="animal-form-row">
          <label className="field">
            <span className="field-label">Type</span>
            <select className="select" value={form.kind} onChange={(event) => set({ kind: event.target.value })}>
              {MEDICAL_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input className="input" type="date" required max={today()} value={form.date} onChange={(event) => set({ date: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">What was done</span>
          <input className="input" required maxLength={150} value={form.title} onChange={(event) => set({ title: event.target.value })} placeholder={form.kind === "vaccination" ? "e.g. Rabies vaccine" : `e.g. ${medicalKind(form.kind).label}`} />
        </label>
        <div className="animal-form-row">
          <label className="field">
            <span className="field-label">Vet or clinic (optional)</span>
            <input className="input" maxLength={150} value={form.vet} onChange={(event) => set({ vet: event.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Weight in kg (optional)</span>
            <input className="input" type="number" min={0.01} step={0.01} max={999} value={form.weight_kg} onChange={(event) => set({ weight_kg: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Notes (optional)</span>
          <textarea className="textarea" value={form.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="Findings, dose, what to watch for." />
        </label>
        <label className="field">
          <span className="field-label">Follow-up date (optional)</span>
          <input className="input" type="date" min={form.date} value={form.next_due ?? ""} onChange={(event) => set({ next_due: event.target.value })} />
          <span className="field-hint">When this needs doing again. It shows as due on the Animals page.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.is_public} onChange={(event) => set({ is_public: event.target.checked })} /> Show on the public profile
        </label>
      </form>
    </Modal>
  );
}

/** Confirms one move through the lifecycle, says what it will do, and asks why when it matters. */
export function StatusMoveDialog({ animal, move, pendingApplications, onClose, onSaved }: {
  animal: Animal;
  move: StatusMove;
  pendingApplications: number;
  onClose: () => void;
  onSaved: (animal: Animal) => void;
}) {
  const [note, setNote] = useState("");
  const { saving, error, run } = useSubmit();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => onSaved(await updateAnimal(animal.id, { status: move.to, status_note: note.trim() })));
  };

  return (
    <Modal
      title={`${move.label}: ${animal.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="status-move-form" className="btn btn-primary" disabled={saving || (move.noteRequired && !note.trim())}>
            {saving ? "Saving…" : "Confirm"}
          </button>
        </>
      }
    >
      <form id="status-move-form" className="stack animal-form" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <p>{move.explain}</p>
        {pendingApplications ? (
          <p className="alert alert-info">{pendingApplications} pending application{pendingApplications === 1 ? "" : "s"} for {animal.name}.</p>
        ) : null}
        <label className="field">
          <span className="field-label">{move.noteLabel}</span>
          <textarea className="textarea" required={move.noteRequired} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={move.notePlaceholder} />
          <span className="field-hint">Kept in the record's timeline. Only your team sees it.</span>
        </label>
      </form>
    </Modal>
  );
}
