import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  ExternalLink,
  FileText,
  HeartHandshake,
  House,
  IdCard,
  LayoutGrid,
  Megaphone,
  PawPrint,
  Plus,
  Send,
  Stethoscope,
  UploadCloud,
  Users,
} from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import FundingMeter from "../components/FundingMeter";
import Modal from "../ui/Modal";
import { createAnimal, createPost, getMyCases, getOrganizationAnimals, getPublicFeed, updateAnimal } from "../services/platformService";
import type { Animal, Case, Post, PostCategory } from "../types/platform";
import { formatRelativeTime } from "../utils/time";
import Combobox from "../ui/Combobox";
import { breedsFor } from "../data/breeds";
import "../styles/Portal.css";
import "../styles/AnimalManagement.css";

const emptyAnimalForm = {
  case: "",
  name: "",
  breed: "",
  species: "",
  gender: "",
  age: "",
  color: "",
  microchip_id: "",
  funding_goal_pkr: "",
  description: "",
  medical_info: "",
  status: "rescued",
  image: null as File | null,
};

const emptyPostForm = {
  animal: "",
  title: "",
  category: "" as PostCategory,
  content: "",
  image: null as File | null,
};

const CATEGORY_OPTIONS: { value: PostCategory; label: string; icon: LucideIcon }[] = [
  { value: "medical", label: "Medical Recovery", icon: Stethoscope },
  { value: "adoption", label: "Adoption Ready", icon: House },
  { value: "sponsorship", label: "Sponsorship Goal", icon: HeartHandshake },
  { value: "foster", label: "Foster Found", icon: Users },
];

function toFormData(values: Record<string, string | File | null>): FormData {
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    if (value !== null && value !== "") {
      formData.append(key, value);
    }
  });
  return formData;
}

function AnimalManagement() {
  const [searchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Post[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "recovering" | "adoptable" | "adopted">("all");
  const [animalForm, setAnimalForm] = useState({
    ...emptyAnimalForm,
    case: searchParams.get("caseId") ?? "",
  });
  const [postForm, setPostForm] = useState(emptyPostForm);
  const [animalImagePreview, setAnimalImagePreview] = useState<string | null>(null);
  // Arriving from a case ("Create animal profile") opens the form straight away.
  const [showForm, setShowForm] = useState(Boolean(searchParams.get("caseId")));
  const [showPost, setShowPost] = useState(false);

  const loadData = async () => {
    const [animalsData, casesData] = await Promise.all([getOrganizationAnimals(), getMyCases()]);
    setAnimals(animalsData);
    setCases(casesData.filter((item) => item.status === "rescued" || item.status === "adoption"));

    const orgId = animalsData[0]?.organization?.id;
    if (!orgId) {
      setRecentUpdates([]);
      return;
    }

    try {
      const feed = await getPublicFeed();
      setRecentUpdates(
        feed
          .filter((post) => post.organization?.id === orgId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3),
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadData only sets state after its first await
    loadData().catch(console.error);
  }, []);

  const handleAnimalImageChange = (file: File | null) => {
    setAnimalForm((current) => ({ ...current, image: file }));
    setAnimalImagePreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const resetAnimalForm = () => {
    setAnimalForm(emptyAnimalForm);
    setAnimalImagePreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return null;
    });
  };

  const handleAnimalCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await createAnimal(toFormData(animalForm));
    resetAnimalForm();
    setShowForm(false);
    loadData().catch(console.error);
  };

  const handleAnimalStatusUpdate = async (animalId: number, status: string) => {
    await updateAnimal(animalId, { status });
    loadData().catch(console.error);
  };

  const handlePostCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await createPost(toFormData(postForm));
    setPostForm(emptyPostForm);
    setShowPost(false);
    loadData().catch(console.error);
  };

  const toggleCategory = (value: PostCategory) => {
    setPostForm((current) => ({ ...current, category: current.category === value ? "" : value }));
  };

  const filterCounts = {
    all: animals.length,
    recovering: animals.filter((animal) => animal.status === "recovering").length,
    adoptable: animals.filter((animal) => animal.status === "adoptable").length,
    adopted: animals.filter((animal) => animal.status === "adopted").length,
  };

  const filteredAnimals = activeFilter === "all" ? animals : animals.filter((animal) => animal.status === activeFilter);

  const TILES: { key: typeof activeFilter; label: string; hint: string; icon: LucideIcon; tint: string }[] = [
    { key: "all", label: "All animals", hint: "in your care", icon: LayoutGrid, tint: "blue" },
    { key: "recovering", label: "Recovering", hint: "being treated", icon: Stethoscope, tint: "coral" },
    { key: "adoptable", label: "Adoptable", hint: "ready for a home", icon: House, tint: "purple" },
    { key: "adopted", label: "Adopted", hint: "happy endings", icon: HeartHandshake, tint: "green" },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Animals</h1>
          <p>Every animal in your care: track recovery, open them for adoption and share updates.</p>
        </div>
        <div className="portal-actions">
          <button className="secondary-btn" type="button" onClick={() => setShowPost(true)} disabled={!animals.length}>
            <Megaphone size={15} /> Post update
          </button>
          <button className="primary-btn" type="button" onClick={() => setShowForm(true)} aria-expanded={showForm} aria-controls="add-animal">
            <Plus size={15} /> Add animal
          </button>
        </div>
      </div>

      {/* The four statuses double as filters: one glance tells the team where everyone is. */}
      <div className="am-tiles" role="group" aria-label="Filter animals by status">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={`am-tile tint-${tile.tint}${activeFilter === tile.key ? " is-active" : ""}`}
            aria-pressed={activeFilter === tile.key}
            onClick={() => setActiveFilter(tile.key)}
          >
            <span className="am-tile-icon"><tile.icon size={16} /></span>
            <span className="am-tile-value">{filterCounts[tile.key]}</span>
            <span className="am-tile-label">{tile.label} <span>{tile.hint}</span></span>
          </button>
        ))}
      </div>

      {showForm ? (
        <section className="panel-card am-section" id="add-animal" aria-labelledby="add-animal-title">
          <div className="am-section-heading">
            <span className="am-section-icon"><PawPrint size={16} /></span>
            <div>
              <h2 id="add-animal-title">Add an animal</h2>
              <p className="meta-line">Create a profile for an animal from one of your rescued cases. It appears on your public page.</p>
            </div>
          </div>
          <form className="am-form" onSubmit={handleAnimalCreate}>
            <label className="am-field">
              <span className="am-field-label">Case Reference <span className="am-required">*</span></span>
              <select value={animalForm.case} onChange={(e) => setAnimalForm({ ...animalForm, case: e.target.value })} required>
                <option value="">Select rescued case</option>
                {cases.map((caseItem) => <option key={caseItem.id} value={caseItem.id}>{caseItem.id} · {caseItem.description}</option>)}
              </select>
            </label>

            <div className="am-field-grid-4 am-field-grid">
              <label className="am-field">
                <span className="am-field-label">Animal Name <span className="am-required">*</span></span>
                <input value={animalForm.name} onChange={(e) => setAnimalForm({ ...animalForm, name: e.target.value })} required />
              </label>
              <div className="am-field">
                <span className="am-field-label" aria-hidden="true">Breed</span>
                <Combobox
                  bare
                  label="Breed"
                  value={animalForm.breed}
                  options={breedsFor(animalForm.species)}
                  placeholder="Search or type a breed"
                  onChange={(breed) => setAnimalForm({ ...animalForm, breed })}
                />
              </div>
              <label className="am-field">
                <span className="am-field-label">Species</span>
                <select value={animalForm.species} onChange={(e) => setAnimalForm({ ...animalForm, species: e.target.value })}>
                  <option value="">Choose…</option>
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="am-field">
                <span className="am-field-label">Shelter Care Status</span>
                <select value={animalForm.status} onChange={(e) => setAnimalForm({ ...animalForm, status: e.target.value })}>
                  <option value="rescued">Rescued</option>
                  <option value="recovering">Recovering</option>
                  <option value="adoptable">Adoptable</option>
                  <option value="adopted">Adopted</option>
                </select>
              </label>
            </div>

            <div className="am-field-grid">
              <label className="am-field">
                <span className="am-field-label">Gender <span className="am-optional">(Optional)</span></span>
                <input placeholder="Male, Female..." value={animalForm.gender} onChange={(e) => setAnimalForm({ ...animalForm, gender: e.target.value })} />
              </label>
              <label className="am-field">
                <span className="am-field-label">Age (Years) <span className="am-optional">(Optional)</span></span>
                <input type="number" min="0" placeholder="e.g. 2" value={animalForm.age} onChange={(e) => setAnimalForm({ ...animalForm, age: e.target.value })} />
              </label>
              <label className="am-field">
                <span className="am-field-label">Color / Markings <span className="am-optional">(Optional)</span></span>
                <input value={animalForm.color} onChange={(e) => setAnimalForm({ ...animalForm, color: e.target.value })} />
              </label>
            </div>

            <label className="am-field">
              <span className="am-field-label">Microchip / Collar Tag ID <span className="am-optional">(Optional)</span></span>
              <div className="am-input-icon">
                <IdCard size={15} />
                <input value={animalForm.microchip_id} onChange={(e) => setAnimalForm({ ...animalForm, microchip_id: e.target.value })} />
              </div>
              <span className="am-field-hint">Used to verify ownership and match lost-pet reports.</span>
            </label>

            <label className="am-field">
              <span className="am-field-label">Care Funding Goal (Rs) <span className="am-optional">(Optional)</span></span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder="e.g. 15000"
                value={animalForm.funding_goal_pkr}
                onChange={(e) => setAnimalForm({ ...animalForm, funding_goal_pkr: e.target.value })}
              />
              <span className="am-field-hint">What treatment, food and shelter will cost until adoption. Sponsors see how much is still needed.</span>
            </label>

            <label className="am-field">
              <span className="am-field-label">Public Adoption Description</span>
              <textarea value={animalForm.description} onChange={(e) => setAnimalForm({ ...animalForm, description: e.target.value })} />
            </label>

            <label className="am-field">
              <span className="am-field-label">Clinical &amp; Medical Info</span>
              <textarea value={animalForm.medical_info} onChange={(e) => setAnimalForm({ ...animalForm, medical_info: e.target.value })} />
              <span className="am-field-hint">Vaccinations, spay/neuter, allergy details.</span>
            </label>

            <div className="am-field">
              <span className="am-field-label">Animal High-Res Photo</span>
              {animalImagePreview ? (
                <div className="am-upload-preview">
                  <img src={animalImagePreview} alt="Selected animal" />
                  <label className="am-upload-change">
                    Change Photo
                    <input type="file" accept="image/*" onChange={(e) => handleAnimalImageChange(e.target.files?.[0] ?? null)} hidden />
                  </label>
                </div>
              ) : (
                <label className="am-upload-zone">
                  <UploadCloud size={20} />
                  <span>Click to upload a high-resolution photo</span>
                  <span className="am-field-hint">PNG or JPG, clear and well-lit</span>
                  <input type="file" accept="image/*" onChange={(e) => handleAnimalImageChange(e.target.files?.[0] ?? null)} hidden />
                </label>
              )}
            </div>

            <p className="meta-line">Donation and adoption contact details are taken from your organization profile.</p>

            <div className="portal-actions">
              <button className="secondary-btn" type="button" onClick={() => { resetAnimalForm(); setShowForm(false); }}>
                Cancel
              </button>
              <button className="primary-btn" type="submit">
                <Plus size={15} /> Create Animal Profile
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="am-section">
        <div className="card-grid am-animal-grid">
          {filteredAnimals.length ? filteredAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              onStatusChange={handleAnimalStatusUpdate}
              footer={
                <>
                  {animal.funding_goal_pkr ? <FundingMeter size="sm" raised={animal.raised_pkr ?? 0} goal={animal.funding_goal_pkr} caption="raised" /> : null}
                  <span className="am-card-links">
                    <Link className="am-public-link" to={`/animals/${animal.id}`}>
                      <ExternalLink size={14} /> Public page
                    </Link>
                    {animal.application_count ? (
                      <Link className="am-public-link" to={`/applications?animal=${animal.id}`}>
                        <FileText size={14} /> {animal.application_count} application{animal.application_count === 1 ? "" : "s"}
                      </Link>
                    ) : null}
                  </span>
                </>
              }
            />
          )) : (
            <div className="empty-state">
              {animals.length ? "No animals with this status." : "No animals yet. Add one from a rescued case to get started."}
            </div>
          )}
        </div>
      </section>

      {showPost ? (
        <Modal title="Post an update" onClose={() => setShowPost(false)}>
          <div className="am-modal">
            <p className="meta-line">Share a real, dated update about one of your animals. Followers and sponsors see it in their feed.</p>
      <form className="am-form" onSubmit={handlePostCreate}>
        <label className="am-field">
          <span className="am-field-label">Target Rescued Animal <span className="am-required">*</span></span>
          <select value={postForm.animal} onChange={(e) => setPostForm({ ...postForm, animal: e.target.value })} required>
            <option value="">Select animal</option>
            {animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}
          </select>
        </label>

        <label className="am-field">
          <span className="am-field-label">Update Title <span className="am-required">*</span></span>
          <input value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} required />
        </label>

        <div className="am-field">
          <span className="am-field-label">Milestone Category <span className="am-optional">(Optional)</span></span>
          <div className="am-chip-row">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`am-chip${postForm.category === option.value ? " is-active" : ""}`}
                onClick={() => toggleCategory(option.value)}
              >
                <option.icon size={13} /> {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="am-field">
          <span className="am-field-label">Story Content &amp; Medical Notes</span>
          <textarea value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} required />
        </label>

        <label className="am-field">
          <span className="am-field-label">Post Photo <span className="am-optional">(Optional)</span></span>
          <input
            className="am-file-compact"
            type="file"
            accept="image/*"
            onChange={(e) => setPostForm({ ...postForm, image: e.target.files?.[0] ?? null })}
          />
        </label>

        <div className="portal-actions">
          <button className="primary-btn" type="submit">
            <Send size={15} /> Publish Update
          </button>
        </div>
      </form>

      {recentUpdates.length ? (
        <div className="am-recent-updates">
          <span className="am-recent-heading"><Clock size={13} /> Recent Updates</span>
          {recentUpdates.map((post) => (
            <div className="am-recent-update-row" key={post.id}>
              <span className="am-recent-dot" />
              <div>
                <p>{post.title}</p>
                <span className="meta-line">{formatRelativeTime(post.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default AnimalManagement;
