import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  HandCoins,
  Home,
  Link2,
  Newspaper,
  PawPrint,
  Rss,
  Stethoscope,
  Tent,
  TrendingUp,
} from "lucide-react";
import AnimalCard from "./AnimalCard";
import SponsorModal from "./SponsorModal";
import type { Animal, Organization, Post, PostCategory } from "../types/platform";
import { formatRelativeTime } from "../utils/time";
import "../styles/Feed.css";

type FeedContentProps = {
  animals: Animal[];
  posts: Post[];
  selectedAnimal: Animal | null;
  onSelectAnimal: (animal: Animal | null) => void;
  action?: React.ReactNode;
};

type FilterKey = "all" | "adoptable" | "medical" | "sponsorship" | "foster";
type SortOrder = "newest" | "oldest";

const FILTER_PREDICATES: Record<FilterKey, (post: Post) => boolean> = {
  all: () => true,
  adoptable: (post) => post.animal.status === "adoptable",
  medical: (post) => post.category === "medical" || post.animal.status === "recovering",
  sponsorship: (post) => post.category === "sponsorship",
  foster: (post) => post.category === "foster",
};

const CATEGORY_LABEL: Record<Exclude<PostCategory, "">, string> = {
  medical: "Medical",
  adoption: "Adoption",
  sponsorship: "Sponsorship",
  foster: "Foster",
};

const CATEGORY_BADGE_CLASS: Record<Exclude<PostCategory, "">, string> = {
  medical: "badge-amber",
  adoption: "badge-purple",
  sponsorship: "badge-blue",
  foster: "badge-green",
};

function getOrgInitials(name: string): string {
  const trimmed = (name || "Org").trim();
  const initials = trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return initials || "OR";
}

function FeedContent({ animals, posts, selectedAnimal, onSelectAnimal, action }: FeedContentProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);

  const featuredAnimals = animals.slice(0, 3);

  const chipCounts = useMemo(() => {
    const counts = {} as Record<FilterKey, number>;
    (Object.keys(FILTER_PREDICATES) as FilterKey[]).forEach((key) => {
      counts[key] = posts.filter(FILTER_PREDICATES[key]).length;
    });
    return counts;
  }, [posts]);

  const sortedPosts = useMemo(() => {
    const filtered = posts.filter(FILTER_PREDICATES[activeFilter]);
    return filtered.sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });
  }, [posts, activeFilter, sortOrder]);

  const feedStats = useMemo(() => {
    const hubIds = new Set(posts.map((post) => post.organization.id));
    const adoptableAnimalIds = new Set(
      posts.filter((post) => post.animal.status === "adoptable").map((post) => post.animal.id),
    );
    return {
      total: posts.length,
      hubs: hubIds.size,
      adoptable: adoptableAnimalIds.size,
    };
  }, [posts]);

  const partnerHubs = useMemo(() => {
    const seen = new Map<number, Organization>();
    posts.forEach((post) => {
      if (!seen.has(post.organization.id)) {
        seen.set(post.organization.id, post.organization);
      }
    });
    return Array.from(seen.values());
  }, [posts]);

  const handleCopyLink = async (post: Post) => {
    const url = `${window.location.origin}/animals/${post.animal.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPostId(post.id);
      window.setTimeout(() => {
        setCopiedPostId((current) => (current === post.id ? null : current));
      }, 1800);
    } catch {
      /* clipboard unavailable in this browser/context -- fail silently */
    }
  };

  return (
    <div className="portal-page" style={{ padding: "32px" }}>
      <div className="portal-header">
        <div>
          <h1>Public Feed</h1>
          <p>Follow rescue progress, recovery stories, and adoptable animal updates from StrayAid organizations.</p>
        </div>
        {action}
      </div>

      <section className="panel-card feed-toolbar">
        <div className="feed-chip-row" role="group" aria-label="Filter feed updates">
          <button
            type="button"
            className={`feed-chip${activeFilter === "all" ? " is-active" : ""}`}
            aria-pressed={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          >
            <Rss size={14} /> All Feed Updates <span className="feed-chip-count">({chipCounts.all})</span>
          </button>
          <button
            type="button"
            className={`feed-chip${activeFilter === "adoptable" ? " is-active" : ""}`}
            aria-pressed={activeFilter === "adoptable"}
            onClick={() => setActiveFilter("adoptable")}
          >
            <Home size={14} /> Adoptable Pets <span className="feed-chip-count">({chipCounts.adoptable})</span>
          </button>
          <button
            type="button"
            className={`feed-chip${activeFilter === "medical" ? " is-active" : ""}`}
            aria-pressed={activeFilter === "medical"}
            onClick={() => setActiveFilter("medical")}
          >
            <Stethoscope size={14} /> Clinical Recovery <span className="feed-chip-count">({chipCounts.medical})</span>
          </button>
          <button
            type="button"
            className={`feed-chip${activeFilter === "sponsorship" ? " is-active" : ""}`}
            aria-pressed={activeFilter === "sponsorship"}
            onClick={() => setActiveFilter("sponsorship")}
          >
            <HandCoins size={14} /> Sponsorship <span className="feed-chip-count">({chipCounts.sponsorship})</span>
          </button>
          <button
            type="button"
            className={`feed-chip${activeFilter === "foster" ? " is-active" : ""}`}
            aria-pressed={activeFilter === "foster"}
            onClick={() => setActiveFilter("foster")}
          >
            <Tent size={14} /> Foster Placements <span className="feed-chip-count">({chipCounts.foster})</span>
          </button>
        </div>
        <div className="feed-sort-control">
          <ArrowUpDown size={14} />
          <select
            aria-label="Sort feed updates"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <div className="feed-heading-row">
              <span className="feed-heading-icon"><PawPrint size={16} /></span>
              <h2>Public Animal Profiles</h2>
            </div>
            <p className="meta-line">A quick preview of the newest public animal profiles.</p>
          </div>
          {animals.length > featuredAnimals.length ? (
            <Link className="secondary-btn" to="/animals/browse">More Animal Profiles</Link>
          ) : null}
        </div>
        <div className="card-grid">
          {featuredAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              footer={
                <>
                  <p className="meta-line feed-preview-org">
                    <Link className="inline-link" to={`/organizations/${animal.organization.id}`}>
                      {animal.organization.name}
                    </Link>
                  </p>
                  <div className="feed-actions">
                    <Link className="secondary-btn" to={`/animals/${animal.id}`}>View Profile</Link>
                    <Link className="secondary-btn" to={`/organizations/${animal.organization.id}`}>View Organization</Link>
                  </div>
                </>
              }
            />
          ))}
          {!featuredAnimals.length ? <div className="empty-state">No public animal profiles yet.</div> : null}
        </div>
      </section>

      <section className="feed-updates-section">
        <div className="section-heading feed-updates-heading">
          <div>
            <div className="feed-heading-row">
              <span className="feed-heading-icon"><Newspaper size={16} /></span>
              <h2>Latest Updates</h2>
            </div>
            <p className="meta-line">One update per row so you can scroll through the feed comfortably.</p>
          </div>
          <span className="badge">{sortedPosts.length} Update{sortedPosts.length === 1 ? "" : "s"}</span>
        </div>

        <div className="feed-layout">
          <div className="feed-main">
            {sortedPosts.map((post) => {
              const image = post.image ?? post.animal.image;
              const category = post.category;
              return (
                <article className="panel-card feed-update-card" key={post.id}>
                  <div className="feed-update-head">
                    <div className="feed-update-org">
                      <span className="feed-avatar" aria-hidden="true">{getOrgInitials(post.organization.name)}</span>
                      <div>
                        <div className="feed-update-org-name">
                          <Link className="inline-link" to={`/organizations/${post.organization.id}`}>
                            {post.organization.name}
                          </Link>
                          {post.organization.is_verified ? (
                            <span className="badge badge-green feed-verified-pill">
                              <BadgeCheck size={11} /> Verified Team
                            </span>
                          ) : null}
                        </div>
                        <p className="meta-line feed-update-time"><Clock size={12} /> {formatRelativeTime(post.created_at)}</p>
                      </div>
                    </div>
                    <div className="feed-update-head-actions">
                      {category ? (
                        <span className={`badge ${CATEGORY_BADGE_CLASS[category]}`}>{CATEGORY_LABEL[category]}</span>
                      ) : null}
                      <button type="button" className="secondary-btn sponsor-chip" onClick={() => onSelectAnimal(post.animal)}>
                        Donation Info
                      </button>
                    </div>
                  </div>

                  {image ? (
                    <div className="feed-image-shell update-media-shell">
                      <img className="card-media" src={image} alt={post.title} />
                    </div>
                  ) : null}

                  <h3>{post.title}</h3>
                  <p className="meta-line">
                    Animal:{" "}
                    <Link className="inline-link" to={`/animals/${post.animal.id}`}>
                      {post.animal.name}
                    </Link>
                  </p>
                  <p className="feed-update-content">{post.content}</p>

                  <div className="feed-actions">
                    <Link className="secondary-btn" to={`/animals/${post.animal.id}`}>View Animal</Link>
                    <Link className="secondary-btn" to={`/organizations/${post.organization.id}`}>View Organization</Link>
                    <button type="button" className="secondary-btn feed-copy-btn" onClick={() => handleCopyLink(post)}>
                      {copiedPostId === post.id ? (
                        <><CheckCircle2 size={14} /> Copied</>
                      ) : (
                        <><Link2 size={14} /> Copy Link</>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
            {!sortedPosts.length ? (
              <div className="empty-state">
                {posts.length ? "No updates match this filter yet." : "No public updates yet."}
              </div>
            ) : null}
          </div>

          <aside className="feed-side">
            <div className="panel-card feed-stats-panel">
              <div className="feed-side-heading">
                <span className="feed-side-icon"><TrendingUp size={16} /></span>
                <div>
                  <h2>This Feed</h2>
                  <p className="meta-line">Live counts from what&apos;s actually posted right now.</p>
                </div>
              </div>
              <div className="feed-stat-rows">
                <div className="feed-stat-row">
                  <span className="feed-stat-icon feed-stat-icon-blue"><Rss size={16} /></span>
                  <div>
                    <strong>{feedStats.total}</strong>
                    <p className="feed-stat-label">Updates</p>
                  </div>
                </div>
                <div className="feed-stat-row">
                  <span className="feed-stat-icon feed-stat-icon-green"><Building2 size={16} /></span>
                  <div>
                    <strong>{feedStats.hubs}</strong>
                    <p className="feed-stat-label">Active Rescue Hubs</p>
                  </div>
                </div>
                <div className="feed-stat-row">
                  <span className="feed-stat-icon feed-stat-icon-purple"><Home size={16} /></span>
                  <div>
                    <strong>{feedStats.adoptable}</strong>
                    <p className="feed-stat-label">Adoptable Now</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-card feed-partners-panel">
              <div className="feed-side-heading">
                <span className="feed-side-icon"><Building2 size={16} /></span>
                <div>
                  <h2>Active Partner Hubs</h2>
                  <p className="meta-line">Organizations currently posting in this feed.</p>
                </div>
              </div>
              <ul className="feed-partner-list">
                {partnerHubs.map((org) => (
                  <li key={org.id}>
                    <Link className="feed-partner-link" to={`/organizations/${org.id}`}>
                      <span className="feed-avatar feed-avatar-sm" aria-hidden="true">{getOrgInitials(org.name)}</span>
                      <span>{org.name}</span>
                    </Link>
                    <ChevronRight size={14} className="feed-partner-chevron" />
                  </li>
                ))}
                {!partnerHubs.length ? <li className="feed-partner-empty">No organizations have posted yet.</li> : null}
              </ul>
            </div>
          </aside>
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
