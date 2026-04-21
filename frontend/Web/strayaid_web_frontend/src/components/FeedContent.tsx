import { Link } from "react-router-dom";
import SponsorModal from "./SponsorModal";
import type { Animal, Post } from "../types/platform";

type FeedContentProps = {
  animals: Animal[];
  posts: Post[];
  selectedAnimal: Animal | null;
  onSelectAnimal: (animal: Animal | null) => void;
  action?: React.ReactNode;
};

function FeedContent({ animals, posts, selectedAnimal, onSelectAnimal, action }: FeedContentProps) {
  return (
    <div className="portal-page" style={{ padding: "32px" }}>
      <div className="portal-header">
        <div>
          <h1>Public Feed</h1>
          <p>Follow rescue progress, recovery stories, and adoptable animal updates from StrayAid organizations.</p>
        </div>
        {action}
      </div>

      <section className="panel-card">
        <h2>Public Animal Profiles</h2>
        <div className="card-grid">
          {animals.map((animal) => (
            <article className="animal-card" key={animal.id}>
              {animal.image ? <img className="card-media" src={animal.image} alt={animal.name} /> : null}
              <span className="badge">{animal.status}</span>
              <h3>{animal.name}</h3>
              <p>
                <Link className="inline-link" to={`/organizations/${animal.organization.id}`}>
                  {animal.organization.name}
                </Link>
              </p>
              <div className="feed-actions">
                <Link className="secondary-btn" to={`/animals/${animal.id}`}>View Profile</Link>
                <Link className="secondary-btn" to={`/organizations/${animal.organization.id}`}>View Organization</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <h2>Latest Updates</h2>
        <div className="card-grid">
          {posts.map((post) => (
            <article className="feed-card" key={post.id}>
              <div className="feed-card-header">
                <Link className="badge badge-link" to={`/organizations/${post.organization.id}`}>
                  {post.organization.name}
                </Link>
                <button type="button" className="secondary-btn sponsor-chip" onClick={() => onSelectAnimal(post.animal)}>
                  Donation Info
                </button>
              </div>
              {post.image ? (
                <div className="feed-image-shell">
                  <img className="card-media" src={post.image} alt={post.title} />
                </div>
              ) : post.animal.image ? (
                <div className="feed-image-shell">
                  <img className="card-media" src={post.animal.image} alt={post.animal.name} />
                </div>
              ) : null}
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <div className="feed-actions">
                <Link className="secondary-btn" to={`/animals/${post.animal.id}`}>View Animal</Link>
                <Link className="secondary-btn" to={`/organizations/${post.organization.id}`}>View Organization</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SponsorModal
        isOpen={Boolean(selectedAnimal)}
        onClose={() => onSelectAnimal(null)}
        title={selectedAnimal ? `Support ${selectedAnimal.name}` : "Donation Information"}
        donationInfo={selectedAnimal?.donation_info}
      />
    </div>
  );
}

export default FeedContent;
