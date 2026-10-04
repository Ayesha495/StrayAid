import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  HeartHandshake,
  Mail,
  Newspaper,
  Pencil,
  PawPrint,
  PhoneCall,
  ScanLine,
  User,
  Wallet,
} from "lucide-react";
import SafeImage from "../components/SafeImage";
import AnimalEditModal from "../components/AnimalEditModal";
import SponsorModal from "../components/SponsorModal";
import { useCurrentUser } from "../services/authSevice";
import { getAnimal, getAnimalPosts } from "../services/platformService";
import type { Animal, Post } from "../types/platform";
import { caseLabel } from "../utils/identifiers";
import { statusBadgeClass } from "../utils/status";
import "../styles/Portal.css";
import "../styles/PublicProfile.css";

function AnimalDetail() {
  const { animalId = "" } = useParams();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSponsorOpen, setIsSponsorOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    getAnimal(animalId).then(setAnimal).catch(() => setAnimal(null));
    getAnimalPosts(animalId).then(setPosts).catch(() => setPosts([]));
  }, [animalId]);

  if (!animal) {
    return <div className="empty-state">Animal profile not found.</div>;
  }

  // Same ownership check the organization profile page uses.
  const isOwner = Boolean(currentUser?.email) && currentUser?.email === animal.organization.user_email;

  const facts = [
    { key: "species", label: "Species", value: animal.species || "Not shared", icon: <PawPrint size={16} />, tone: "blue" },
    { key: "gender", label: "Gender", value: animal.gender || "Not shared", icon: <User size={16} />, tone: "purple" },
    { key: "age", label: "Age", value: animal.age != null ? `${animal.age} yr${animal.age === 1 ? "" : "s"}` : "Not shared", icon: <CalendarDays size={16} />, tone: "amber" },
    { key: "color", label: "Color / Markings", value: animal.color || "Not shared", icon: <PawPrint size={16} />, tone: "green" },
    { key: "microchip", label: "Microchip ID", value: animal.microchip_id || "Not chipped", icon: <ScanLine size={16} />, tone: "gray" },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="detail-title-row">
            <h1>{animal.name}</h1>
            <span className={statusBadgeClass(animal.status)}>{animal.status}</span>
            <span className="status-card-case-tag">{caseLabel(animal.case_id)}</span>
          </div>
          <p>
            <Link className="link" to={`/organizations/${animal.organization.id}`}>
              {animal.organization.name}
            </Link>
            {animal.breed ? ` · ${animal.breed}` : ""}
          </p>
        </div>
        {isOwner ? (
          <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(true)}>
            <Pencil size={16} /> Edit Profile
          </button>
        ) : null}
      </div>

      <section className="public-stat-strip">
        {facts.map((fact) => (
          <div className="public-stat-chip" key={fact.key}>
            <span className={`public-stat-icon public-stat-icon-${fact.tone}`}>{fact.icon}</span>
            <div className="public-stat-body">
              <p className="public-stat-label">{fact.label}</p>
              <p className="public-stat-value">{fact.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="panel-card">
        <div className="detail-hero-media-shell">
          <SafeImage
            src={animal.image}
            alt={animal.name}
            className="detail-hero-image detail-hero-image-fit"
            fallback={<PawPrint size={40} />}
            fallbackClassName="media-placeholder"
          />
        </div>
        <p>{animal.description}</p>
        <p className="meta-line">Medical Info: {animal.medical_info || "No medical notes shared yet."}</p>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>For Adoption</h2>
            <p className="meta-line">How adopters can reach the team caring for {animal.name}.</p>
          </div>
        </div>
        {animal.adoption_info ? (
          <div className="donation-info-card">
            <div className="donation-info-row">
              <span className="donation-info-icon"><HeartHandshake size={16} /></span>
              <div className="donation-info-text">
                <p className="donation-info-label">Message</p>
                <p className="donation-info-value">{animal.adoption_info.message || "Not shared"}</p>
              </div>
            </div>
            <div className="donation-info-row">
              <span className="donation-info-icon"><PhoneCall size={16} /></span>
              <div className="donation-info-text">
                <p className="donation-info-label">Phone</p>
                <p className="donation-info-value">{animal.adoption_info.phone || "Not shared"}</p>
              </div>
            </div>
            <div className="donation-info-row">
              <span className="donation-info-icon"><Mail size={16} /></span>
              <div className="donation-info-text">
                <p className="donation-info-label">Email</p>
                <p className="donation-info-value">{animal.adoption_info.email || "Not shared"}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="meta-line">Adoption contact information is not available yet.</p>
        )}
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Donation Information</h2>
            <p className="meta-line">Support this rescue directly using the organization details shared for {animal.name}.</p>
          </div>
        </div>
        <div className="feed-actions">
          <Link className="btn btn-secondary" to={`/organizations/${animal.organization.id}`}>View Organization</Link>
          <button type="button" className="btn btn-primary" onClick={() => setIsSponsorOpen(true)}>
            <Wallet size={16} /> View Donation Information
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Organization Updates</h2>
            <p className="meta-line">Real, dated updates the rescue team has shared about {animal.name}.</p>
          </div>
        </div>
        <div className={posts.length > 1 ? "feed-posts-grid" : "stacked-feed"}>
          {posts.length ? posts.map((post) => (
            <article className={`feed-card${posts.length === 1 ? " single-update-card" : ""}`} key={post.id}>
              {posts.length === 1 ? (
                <div className="detail-hero-media-shell update-media-shell">
                  <SafeImage
                    src={post.image}
                    alt={post.title}
                    className="detail-hero-image detail-hero-image-fit"
                    fallback={<Newspaper size={36} />}
                    fallbackClassName="media-placeholder"
                  />
                </div>
              ) : (
                <SafeImage
                  src={post.image}
                  alt={post.title}
                  className="card-media"
                  fallback={<Newspaper size={32} />}
                  fallbackClassName="card-media media-placeholder"
                />
              )}
              <h3>{post.title}</h3>
              <p>{post.content}</p>
              <p className="meta-line">{new Date(post.created_at).toLocaleString()}</p>
            </article>
          )) : <div className="empty-state">No updates yet.</div>}
        </div>
      </section>

      {isOwner && isEditOpen ? (
        <AnimalEditModal
          animal={animal}
          onClose={() => setIsEditOpen(false)}
          onSaved={(updated) => {
            setAnimal(updated);
            setIsEditOpen(false);
          }}
        />
      ) : null}

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
