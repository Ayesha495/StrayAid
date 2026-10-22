import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BellRing,
  HandCoins,
  Heart,
  HeartHandshake,
  Mail,
  MapPin,
  MessageSquare,
  PawPrint,
  Phone,
  PhoneCall,
  Ruler,
  Settings,
  Share2,
  Stethoscope,
  Truck,
  Users,
} from "lucide-react";
import { getPublicOrganization, getPublicOrganizationAnimals } from "../services/platformService";
import { getOrganizationStats } from "../services/fundingService";
import { donateToOrganization, followOrganization } from "../services/socialService";
import { getFeed } from "../services/postService";
import { startConversation } from "../services/chatService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import AnimalTile from "../components/AnimalTile";
import FundingMeter from "../components/FundingMeter";
import SectionNav from "../components/SectionNav";
import ServiceAreaMap from "../components/ServiceAreaMap";
import UpdateGrid from "../components/UpdateGrid";
import PledgeForm from "../components/support/PledgeForm";
import { errorMessage } from "../utils/errors";
import type { Animal } from "../types/platform";
import "../components/AnimalTile.css";
import "./OrganizationProfile.css";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "adoptable", label: "Ready for a home" },
  { key: "recovering", label: "Recovering" },
  { key: "adopted", label: "Adopted" },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

/** How far an animal's care is from funded, for "Needs your help most". */
const fundingGap = (animal: Animal) => (animal.funding_goal_pkr ?? 0) - (animal.raised_pkr ?? 0);

/** A rescue organization's public page: who they are, their animals, and how to help. */
function OrganizationPublicProfile() {
  const { organizationId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isOrganization, organization: mine } = useShell();
  const profile = useApi(() => getPublicOrganization(organizationId), organizationId);
  const stats = useApi(() => getOrganizationStats(organizationId), `${organizationId}:${user?.id ?? ""}`);
  const animals = useApi(() => getPublicOrganizationAnimals(organizationId), organizationId);
  const feed = useApi(getFeed, String(user?.id ?? "guest"));
  const [filter, setFilter] = useState("all");
  const [giving, setGiving] = useState(false);
  const [busy, setBusy] = useState(false);

  const allAnimals = useMemo(() => animals.data ?? [], [animals.data]);
  const needsHelp = useMemo(
    () => allAnimals.filter((animal) => animal.status !== "adopted" && fundingGap(animal) > 0).sort((a, b) => fundingGap(b) - fundingGap(a)).slice(0, 3),
    [allAnimals],
  );
  const coverPhotos = useMemo(() => allAnimals.map((animal) => animal.image).filter(Boolean).slice(0, 3) as string[], [allAnimals]);
  const posts = useMemo(() => (feed.data ?? []).filter((post) => String(post.organization?.id) === organizationId).slice(0, 9), [feed.data, organizationId]);

  const org = profile.data;
  if (profile.error && !org) {
    return <div className="page"><ErrorState title="Organization not found" message={errorMessage(profile.error)} onRetry={profile.reload} /></div>;
  }
  if (!org) {
    return <div className="page org-page"><Skeleton height={300} style={{ marginBottom: 16 }} /><Skeleton height={140} /></div>;
  }

  const own = Boolean(mine && mine.id === org.id);
  const following = Boolean(stats.data?.following);
  const accepting = stats.data?.is_available ?? true;
  const fund = stats.data?.fund;
  const visibleAnimals = allAnimals.filter((animal) => filter === "all" || animal.status === filter);
  const tagline = org.description?.split(/(?<=[.!?])\s/)[0] ?? "";
  const capacity = org.capacity ?? 0;
  const active = stats.data?.stats.active_cases ?? 0;
  const supporter = !own && !isOrganization;

  const requireLogin = () => navigate("/login", { state: { from: location.pathname } });

  const act = async (fn: () => Promise<void>) => {
    if (!user) return requireLogin();
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast({ title: "Something went wrong", body: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = () =>
    act(async () => {
      await followOrganization(org.id, !following);
      if (stats.data) stats.setData({ ...stats.data, following: !following, stats: { ...stats.data.stats, followers: stats.data.stats.followers + (following ? -1 : 1) } });
      toast({ title: following ? `Unfollowed ${org.name}` : `Following ${org.name}`, body: following ? undefined : "Their rescues and updates will show in your notifications." });
    });

  const message = () =>
    act(async () => {
      const conversation = await startConversation({ organization_id: org.id });
      navigate(`/messages/${conversation.id}`);
    });

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: `${org.name} on StrayAid`, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast({ title: "Link copied" });
    }
  };

  const STATS = stats.data
    ? [
        { label: "Animals rescued", value: stats.data.stats.rescued, icon: <PawPrint size={18} />, tone: "green" },
        { label: "In care now", value: stats.data.stats.in_care, icon: <Stethoscope size={18} />, tone: "blue" },
        { label: "Adopted", value: stats.data.stats.adopted, icon: <HeartHandshake size={18} />, tone: "coral" },
        { label: "Active rescues", value: stats.data.stats.active_cases, icon: <Truck size={18} />, tone: "amber" },
      ]
    : [];

  return (
    <div className="page org-page">
      {/* Cover: real photos of the animals they've saved, like a LinkedIn or Facebook page banner. */}
      <header className="org-cover-wrap">
        <div className={`org-cover photos-${coverPhotos.length}`} aria-hidden="true">
          {coverPhotos.map((src) => <img key={src} src={src} alt="" />)}
          <span className="org-cover-shade" />
        </div>

        <div className="org-identity">
          <div className="org-logo">
            <Avatar name={org.name} src={org.image} size={128} square />
          </div>
          <div className="org-identity-text">
            <div className="org-name-row">
              <h1>{org.name}</h1>
              {org.is_verified ? <span className="chip chip-green org-verified"><BadgeCheck size={13} /> Verified rescue</span> : null}
            </div>
            {tagline ? <p className="org-tagline">{tagline}</p> : null}
            <div className="org-meta">
              {org.city || org.address ? <span><MapPin size={15} /> {org.city || org.address}</span> : null}
              {stats.data ? <span><Users size={15} /> {stats.data.stats.followers} {stats.data.stats.followers === 1 ? "follower" : "followers"}</span> : null}
              <span className={`chip ${accepting ? "chip-emerald chip-dot" : "chip-slate"}`}>{accepting ? "Accepting new cases" : "Not taking new cases"}</span>
            </div>
          </div>
          <div className="org-actions">
            {own ? (
              <>
                <Link to="/organization/register" className="btn btn-secondary"><Settings size={16} /> Edit profile</Link>
                <Link to="/dashboard" className="btn btn-primary">Open dashboard <ArrowRight size={16} /></Link>
              </>
            ) : (
              <>
                {supporter ? (
                  <button type="button" className={`btn ${following ? "btn-secondary" : "btn-primary"}`} onClick={toggleFollow} disabled={busy} aria-pressed={following}>
                    {following ? <BellRing size={16} /> : <Bell size={16} />} {following ? "Following" : "Follow"}
                  </button>
                ) : null}
                {supporter ? (
                  <button type="button" className="btn btn-secondary" onClick={message} disabled={busy}><MessageSquare size={16} /> Message</button>
                ) : null}
                {org.phone_number ? (
                  <a className="btn btn-coral-outline" href={`tel:${org.phone_number}`}><PhoneCall size={16} /> Emergency call</a>
                ) : null}
                <button type="button" className="sa-icon-btn org-share" onClick={share} aria-label={`Share ${org.name}'s page`}><Share2 size={18} /></button>
              </>
            )}
          </div>
        </div>

        {STATS.length ? (
          <dl className="org-stats">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <span className={`org-stat-icon tone-${stat.tone}`} aria-hidden="true">{stat.icon}</span>
                <dd>{stat.value}</dd>
                <dt>{stat.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <div className="org-layout">
        <div className="org-main">
          <SectionNav
            label={`Sections of ${org.name}'s page`}
            sections={[
              ...(needsHelp.length ? [{ id: "help", label: "Needs help" }] : []),
              { id: "animals", label: `Animals (${allAnimals.length})` },
              { id: "updates", label: "Updates" },
              { id: "about", label: "About" },
            ]}
          />

          {needsHelp.length ? (
            <motion.section id="help" className="profile-section" {...reveal}>
              <div className="profile-section-head">
                <h2>Needs your help most</h2>
                <span className="muted small">Furthest from their care goal</span>
              </div>
              <div className="org-help">
                {needsHelp.map((animal) => (
                  <Link key={animal.id} to={`/animals/${animal.id}`} className="card org-help-card">
                    <span className="org-help-photo">{animal.image ? <img src={animal.image} alt="" /> : null}</span>
                    <span className="org-help-body">
                      <strong>{animal.name}</strong>
                      <span className="small muted">{[animal.species, animal.breed].filter(Boolean).join(" · ")}</span>
                      <FundingMeter raised={animal.raised_pkr ?? 0} goal={animal.funding_goal_pkr ?? 0} size="sm" />
                      <span className="org-help-cta"><HandCoins size={15} /> Sponsor {animal.name}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </motion.section>
          ) : null}

          <motion.section id="animals" className="profile-section" {...reveal}>
            <div className="profile-section-head">
              <h2>Animals in their care</h2>
              <div className="filter-row" role="group" aria-label="Filter animals">
                {FILTERS.map((entry) => (
                  <button key={entry.key} type="button" className="filter-pill" aria-pressed={filter === entry.key} onClick={() => setFilter(entry.key)}>
                    {entry.label}
                    <span className="pill-count">{allAnimals.filter((animal) => entry.key === "all" || animal.status === entry.key).length}</span>
                  </button>
                ))}
              </div>
            </div>
            {animals.data ? (
              visibleAnimals.length ? (
                <div className="animal-grid">{visibleAnimals.map((animal) => <AnimalTile key={animal.id} animal={animal} />)}</div>
              ) : (
                <div className="card"><EmptyState icon={<PawPrint size={22} />} title="No animals here" message="Try another filter." /></div>
              )
            ) : (
              <Skeleton height={300} />
            )}
          </motion.section>

          <motion.section id="updates" className="profile-section" {...reveal}>
            <div className="profile-section-head">
              <h2>Latest updates</h2>
              <Link to="/feed" className="link small">See the community feed</Link>
            </div>
            {feed.data ? (
              posts.length ? (
                <UpdateGrid posts={posts} />
              ) : (
                <div className="card"><EmptyState title="No updates yet" message={`Follow ${org.name} to hear about new rescues.`} /></div>
              )
            ) : (
              <Skeleton height={240} />
            )}
          </motion.section>
        </div>

        <aside className="org-rail">
          {fund ? (
            <section className="card card-pad org-fund">
              <h2>{fund.month} medical supplies</h2>
              <p className="small muted">Medicine, bandages and food for every animal in their care this month.</p>
              <FundingMeter raised={fund.raised_pkr} goal={fund.goal_pkr} caption="raised" />
              {supporter ? (
                stats.data?.my_pending_donation ? (
                  <div className="alert alert-info">Your gift is being checked. Thank you!</div>
                ) : (
                  <button type="button" className="btn btn-amber btn-lg btn-block" onClick={() => (user ? setGiving(true) : requireLogin())}>
                    <Heart size={18} /> Give to supplies
                  </button>
                )
              ) : null}
            </section>
          ) : null}

          <section id="about" className="card card-pad org-about profile-section">
            <h2>About</h2>
            {org.description ? <p>{org.description}</p> : null}
            <ul className="org-contact">
              {org.phone_number ? <li><Phone size={16} /> <a className="link" href={`tel:${org.phone_number}`}>{org.phone_number}</a></li> : null}
              {org.contact_email ? <li><Mail size={16} /> <a className="link" href={`mailto:${org.contact_email}`}>{org.contact_email}</a></li> : null}
              {org.address ? <li><MapPin size={16} /> {org.address}</li> : null}
              {org.radius ? <li><Ruler size={16} /> Rescues within {org.radius} km</li> : null}
            </ul>
            {capacity ? (
              <div className="org-capacity">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small strong">Rescue capacity</span>
                  <span className="small muted">{active} of {capacity} in use</span>
                </div>
                <span className="progress"><span style={{ width: `${Math.min(100, (active / capacity) * 100)}%` }} /></span>
              </div>
            ) : null}
            {Number.isFinite(org.latitude) && Number.isFinite(org.longitude) && org.latitude ? (
              <ServiceAreaMap latitude={org.latitude} longitude={org.longitude} radiusKm={org.radius} label={`${org.name}'s service area: ${org.radius ?? 0} km around ${org.city || org.address}`} />
            ) : null}
          </section>
        </aside>
      </div>

      {giving ? (
        <PledgeForm
          title={`Give to ${org.name}`}
          intro="Your gift buys medicine, bandages and food for every animal in their care."
          bank={org.bank_account_number ? { bank: org.bank_name, account_name: org.bank_account_title, account_number: org.bank_account_number } : null}
          onClose={() => setGiving(false)}
          onSubmit={async (form) => {
            await donateToOrganization(org.id, form);
            setGiving(false);
            stats.reload();
            toast({ title: "Thank you!", body: `${org.name} will confirm your receipt soon.`, link: { to: "/my-applications", label: "Track it" } });
          }}
        />
      ) : null}
    </div>
  );
}

export default OrganizationPublicProfile;
