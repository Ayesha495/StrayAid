import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SponsorModal from "../components/SponsorModal";
import { getAnimal, getAnimalPosts } from "../services/platformService";
import type { Animal, Post } from "../types/platform";
import "../styles/Portal.css";

function AnimalDetail() {
  const { animalId = "" } = useParams();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSponsorOpen, setIsSponsorOpen] = useState(false);

  useEffect(() => {
    getAnimal(animalId).then(setAnimal).catch(() => setAnimal(null));
    getAnimalPosts(animalId).then(setPosts).catch(() => setPosts([]));
  }, [animalId]);

  if (!animal) {
    return <div className="empty-state">Animal profile not found.</div>;
  }

  return (
    <div className="portal-page" style={{ padding: "32px" }}>
      <div className="portal-header">
        <div>
          <h1>{animal.name}</h1>
          <p>{animal.organization.name} · {animal.breed || "Breed not specified"}</p>
        </div>
        <span className="badge">{animal.status}</span>
      </div>

      <section className="panel-card">
        {animal.image ? <img className="detail-hero-image" src={animal.image} alt={animal.name} /> : null}
        <p>{animal.description}</p>
        <p className="meta-line">Medical Info: {animal.medical_info || "No medical notes shared yet."}</p>
        <div className="sponsor-panel">
          <div>
            <h2>Sponsor This Animal</h2>
            <p className="meta-line">Support this rescue directly using the organization details shared for {animal.name}.</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setIsSponsorOpen(true)}>
            View Sponsor Details
          </button>
        </div>
      </section>

      <section className="panel-card">
        <h2>Organization Updates</h2>
        <div className="card-grid">
          {posts.length ? posts.map((post) => (
            <article className="feed-card" key={post.id}>
              {post.image ? <img className="card-media" src={post.image} alt={post.title} /> : null}
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <p className="meta-line">{new Date(post.created_at).toLocaleString()}</p>
            </article>
          )) : <div className="empty-state">No updates yet.</div>}
        </div>
      </section>

      <SponsorModal
        isOpen={isSponsorOpen}
        onClose={() => setIsSponsorOpen(false)}
        title={`Support ${animal.name}`}
        donationInfo={animal.donation_info}
      />
    </div>
  );
}

export default AnimalDetail;
