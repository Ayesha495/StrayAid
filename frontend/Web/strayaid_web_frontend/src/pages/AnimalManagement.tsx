import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createAnimal, createPost, getMyCases, getOrganizationAnimals, updateAnimal } from "../services/platformService";
import type { Animal, Case } from "../types/platform";
import "../styles/Portal.css";

function AnimalManagement() {
  const [searchParams] = useSearchParams();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [animalForm, setAnimalForm] = useState({
    case: searchParams.get("caseId") ?? "",
    name: "",
    breed: "",
    description: "",
    medical_info: "",
    status: "rescued",
    image: null as File | null,
  });
  const [postForm, setPostForm] = useState({
    animal: "",
    title: "",
    content: "",
    image: null as File | null,
  });

  const loadData = async () => {
    const [animalsData, casesData] = await Promise.all([getOrganizationAnimals(), getMyCases()]);
    setAnimals(animalsData);
    setCases(casesData.filter((item) => item.status === "rescued" || item.status === "adoption"));
  };

  useEffect(() => {
    loadData().catch(console.error);
  }, []);

  const handleAnimalCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    Object.entries(animalForm).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (value !== null) {
        formData.append(key, value);
      }
    });
    await createAnimal(formData);
    setAnimalForm({
      case: "",
      name: "",
      breed: "",
      description: "",
      medical_info: "",
      status: "rescued",
      image: null,
    });
    loadData().catch(console.error);
  };

  const handleAnimalStatusUpdate = async (animalId: number, status: string) => {
    await updateAnimal(animalId, { status });
    loadData().catch(console.error);
  };

  const handlePostCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    Object.entries(postForm).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (value !== null) {
        formData.append(key, value);
      }
    });
    await createPost(formData);
    setPostForm({ animal: "", title: "", content: "", image: null });
    alert("Post created");
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Animals</h1>
          <p>Create profiles for rescued animals, move them into adoption, mark them adopted, and publish public updates.</p>
        </div>
      </div>

      <section className="panel-card">
        <h2>Create Animal Profile</h2>
        <form className="portal-form" onSubmit={handleAnimalCreate}>
          <div className="portal-form-grid">
            <label>
              Case
              <select value={animalForm.case} onChange={(e) => setAnimalForm({ ...animalForm, case: e.target.value })} required>
                <option value="">Select rescued case</option>
                {cases.map((caseItem) => <option key={caseItem.id} value={caseItem.id}>{caseItem.id} · {caseItem.description}</option>)}
              </select>
            </label>
            <label>Name<input value={animalForm.name} onChange={(e) => setAnimalForm({ ...animalForm, name: e.target.value })} required /></label>
            <label>Breed<input value={animalForm.breed} onChange={(e) => setAnimalForm({ ...animalForm, breed: e.target.value })} /></label>
            <label>
              Status
              <select value={animalForm.status} onChange={(e) => setAnimalForm({ ...animalForm, status: e.target.value })}>
                <option value="rescued">Rescued</option>
                <option value="recovering">Recovering</option>
                <option value="adoptable">Adoptable</option>
                <option value="adopted">Adopted</option>
              </select>
            </label>
          </div>
          <label>Description<textarea value={animalForm.description} onChange={(e) => setAnimalForm({ ...animalForm, description: e.target.value })} /></label>
          <label>Medical Info<textarea value={animalForm.medical_info} onChange={(e) => setAnimalForm({ ...animalForm, medical_info: e.target.value })} /></label>
          <p className="meta-line">Donation and adoption contact details are taken from your organization profile.</p>
          <label>
            Animal Image
            <input type="file" accept="image/*" onChange={(e) => setAnimalForm({ ...animalForm, image: e.target.files?.[0] ?? null })} />
          </label>
          <div className="portal-actions"><button className="primary-btn" type="submit">Create Animal</button></div>
        </form>
      </section>

      <section className="panel-card">
        <h2>Your Animals</h2>
        <div className="card-grid">
          {animals.length ? animals.map((animal) => (
            <article className="animal-card" key={animal.id}>
              {animal.image ? <img className="card-media" src={animal.image} alt={animal.name} /> : null}
              <span className="badge">{animal.status}</span>
              <h3>{animal.name}</h3>
              <p>{animal.description}</p>
              <div className="case-actions">
                <button className="secondary-btn" onClick={() => handleAnimalStatusUpdate(animal.id, "recovering")}>Recovering</button>
                <button className="secondary-btn" onClick={() => handleAnimalStatusUpdate(animal.id, "adoptable")}>Adoptable</button>
                <button className="secondary-btn" onClick={() => handleAnimalStatusUpdate(animal.id, "adopted")}>Adopted</button>
              </div>
            </article>
          )) : <div className="empty-state">No animal profiles yet.</div>}
        </div>
      </section>

      <section className="panel-card">
        <h2>Post Update</h2>
        <form className="portal-form" onSubmit={handlePostCreate}>
          <div className="portal-form-grid">
            <label>
              Animal
              <select value={postForm.animal} onChange={(e) => setPostForm({ ...postForm, animal: e.target.value })} required>
                <option value="">Select animal</option>
                {animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}
              </select>
            </label>
            <label>Title<input value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} required /></label>
            <label>
              Post Image
              <input type="file" accept="image/*" onChange={(e) => setPostForm({ ...postForm, image: e.target.files?.[0] ?? null })} />
            </label>
          </div>
          <label>Content<textarea value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} required /></label>
          <div className="portal-actions"><button className="primary-btn" type="submit">Publish Update</button></div>
        </form>
      </section>
    </div>
  );
}

export default AnimalManagement;
