import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
          <p>
            <Link className="inline-link" to={`/organizations/${animal.organization.id}`}>
              {animal.organization.name}
            </Link>
            {animal.breed ? ` · ${animal.breed}` : ""}
          </p>
        </div>
        <span className="badge">{animal.status}</span>
      </div>

      <section className="panel-card">
        {animal.image ? (
          <div className="detail-hero-media-shell">
            <img className="detail-hero-image detail-hero-image-fit" src={animal.image} alt={animal.name} />
          </div>
        ) : null}
        <p>{animal.description}</p>
        <p className="meta-line">Medical Info: {animal.medical_info || "No medical notes shared yet."}</p>
        <div className="sponsor-panel">
          <div>
            <h2>Donation Information</h2>
            <p className="meta-line">Support this rescue directly using the organization details shared for {animal.name}.</p>
          </div>
          <div className="feed-actions">
            <Link className="secondary-btn" to={`/organizations/${animal.organization.id}`}>View Organization</Link>
            <button type="button" className="primary-btn" onClick={() => setIsSponsorOpen(true)}>
              View Donation Information
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <h2>Organization Updates</h2>
        <div className={posts.length > 1 ? "feed-posts-grid" : "stacked-feed"}>
          {posts.length ? posts.map((post) => (
            <article className={`feed-card${posts.length === 1 ? " single-update-card" : ""}`} key={post.id}>
              {post.image ? (
                posts.length === 1 ? (
                  <div className="detail-hero-media-shell update-media-shell">
                    <img className="detail-hero-image detail-hero-image-fit" src={post.image} alt={post.title} />
                  </div>
                ) : (
                  <img className="card-media" src={post.image} alt={post.title} />
                )
              ) : null}
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
