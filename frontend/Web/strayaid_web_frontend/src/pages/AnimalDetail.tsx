import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  FileText,
  Bell,
  BellRing,
  CalendarHeart,
  Cake,
  Cpu,
  HandCoins,
  Heart,
  HeartPulse,
  Home,
  ImageOff,
  MapPin,
  MessageSquare,
  Palette,
  PawPrint,
  Pencil,
  Share2,
  ShieldCheck,
  Syringe,
  Users,
  VenusAndMars,
} from "lucide-react";
import { getAnimal, getAnimalPosts, updateAnimal } from "../services/platformService";
import { followAnimal, getFollowStatus, sponsorAnimal } from "../services/socialService";
import { getCaseUpdates, getPublicCase } from "../services/caseService";
import { startConversation } from "../services/chatService";
import { getApplications } from "../services/fundingService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import FundingMeter from "../components/FundingMeter";
import SectionNav from "../components/SectionNav";
import UpdateGrid from "../components/UpdateGrid";
import AdoptForm from "../components/support/AdoptForm";
import PledgeForm from "../components/support/PledgeForm";
import { displayNameOf, formatDate } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import { statusLabel } from "../utils/statusStyles";
import "./AnimalDetail.css";

const HEALTH: Record<string, { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "emerald" },
  minor_issues: { label: "Minor issues", tone: "amber" },
  under_treatment: { label: "Under treatment", tone: "blue" },
  special_needs: { label: "Special needs", tone: "coral" },
};

const ADOPTION_STEPS = [
  { title: "Apply online", text: "A short form about your home and routine. About 5 minutes." },
  { title: "Meet and home visit", text: "The rescue team calls you, then you meet and they see where the pet will live." },
  { title: "Welcome home", text: "Sign the adoption agreement and take your new friend home." },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function Fact({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return (
    <div className="animal-fact">
      <span className={`animal-fact-icon tone-${tone}`} aria-hidden="true">{icon}</span>
      <span>
        <span className="animal-fact-label">{label}</span>
        <span className="animal-fact-value">{value}</span>
      </span>
    </div>
  );
}

/** Lets the animal's organization set or change the care funding goal in place. */
function GoalEditor({ goal, onSave }: { goal: number; onSave: (value: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal || ""));
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Opening the editor moves the cursor into it, for keyboard and screen reader users alike.
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button type="button" className="btn btn-ghost btn-sm goal-edit" onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden="true" /> {goal ? "Edit care goal" : "Set a care goal"}
      </button>
    );
  }
  return (
    <form
      className="goal-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave(Math.max(0, Number(value) || 0));
          setEditing(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="goal-input">Care funding goal in rupees</label>
      <input id="goal-input" className="input" type="number" min={0} step={500} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Rs" ref={input} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** An animal's profile: who they are, how they're doing, and how people can help. */
function AnimalDetail() {
  const { animalId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isOrganization, organization: myOrganization } = useShell();
  const animal = useApi(() => getAnimal(animalId), `${animalId}:${user?.id ?? ""}`);
  const posts = useApi(() => getAnimalPosts(animalId), animalId);
  const follow = useApi(
    () => (user && !isOrganization ? getFollowStatus({ animal_id: Number(animalId) }) : Promise.resolve({ following_animal: false })),
    `${animalId}:${user?.id ?? ""}`,
  );
  const caseId = animal.data?.case_id ?? animal.data?.case;
  const rescue = useApi(() => (caseId ? getPublicCase(caseId) : Promise.resolve(null)), String(caseId ?? ""));
  const history = useApi(() => (caseId ? getCaseUpdates(caseId) : Promise.resolve([])), String(caseId ?? ""));
  // The animal's own team sees who has applied to adopt it.
  const isMine = Boolean(myOrganization && animal.data?.organization?.id === myOrganization.id);
  const applications = useApi(() => (isMine ? getApplications() : Promise.resolve([])), `${animalId}:${isMine}`);
  const [photo, setPhoto] = useState(0);
  const [dialog, setDialog] = useState<"adopt" | "sponsor" | null>(null);
  const [busy, setBusy] = useState(false);

  const data = animal.data;
  if (animal.error && !data) {
    return <div className="page"><ErrorState title="Animal not found" message={errorMessage(animal.error)} onRetry={animal.reload} /></div>;
  }
  if (!data) {
    return (
      <div className="page animal-page">
        <div className="animal-layout"><Skeleton height={520} /><Skeleton height={520} /></div>
      </div>
    );
  }

  const extras = data as typeof data & {
    my_application?: { id: number; status: string } | null;
    my_sponsorship?: { status: string; amount_pkr: number } | null;
  };
  const photos = (data.photos?.length ? data.photos : data.image ? [data.image] : []) as string[];
  const ownAnimal = Boolean(myOrganization && data.organization?.id === myOrganization.id);
  const canSupport = !isOrganization;
  const following = Boolean(follow.data?.following_animal);
  const adoptable = data.status === "adoptable";
  const adopted = data.status === "adopted";
  const health = data.health ? HEALTH[data.health] : null;
  const subtitle = [data.breed || data.species, data.age !== null && data.age !== undefined ? `${data.age} ${data.age === 1 ? "year" : "years"} old` : "", data.gender].filter(Boolean).join(" · ");
  // Status changes after the first report ("reported" is shown as the first step already).
  const storySteps = (history.data ?? []).filter((update) => update.status && update.status !== "reported").slice().reverse();
  const postCount = posts.data?.length ?? 0;
  const applicants = (applications.data ?? []).filter((item) => item.animal.id === data.id && item.status !== "withdrawn");
  const waiting = applicants.filter((item) => item.status === "pending").length;
  const applicationsLink = `/applications?animal=${data.id}`;

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
      await followAnimal(data.id, !following);
      follow.setData({ following_animal: !following });
      toast({ title: following ? `Unfollowed ${data.name}` : `Following ${data.name}`, body: following ? undefined : "You'll hear about health updates and new posts." });
    });

  const message = () =>
    act(async () => {
      const conversation = await startConversation({ animal_id: data.id });
      navigate(`/messages/${conversation.id}`);
    });

  const share = async () => {
    const url = window.location.href;
    const shareData = { title: `Meet ${data.name} on StrayAid`, text: `${data.name} is looking for support.`, url };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast({ title: "Link copied", body: `Share ${data.name}'s profile to help them find a home.` });
    }
  };

  const primary = ownAnimal ? (
    <div className="animal-own-actions">
      {applicants.length ? (
        <Link to={applicationsLink} className="btn btn-primary btn-lg btn-block">
          <FileText size={18} /> {waiting ? `Review ${waiting} application${waiting === 1 ? "" : "s"}` : `See ${applicants.length} application${applicants.length === 1 ? "" : "s"}`}
        </Link>
      ) : null}
      <Link to="/animals" className="btn btn-secondary btn-lg btn-block"><Pencil size={18} /> Manage in Animals</Link>
    </div>
  ) : !canSupport ? null : adoptable ? (
    extras.my_application ? (
      <div className="alert alert-success">
        Your application is {statusLabel("review", extras.my_application.status).toLowerCase()}. <Link className="link" to="/my-applications">Track it</Link>
      </div>
    ) : (
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => (user ? setDialog("adopt") : requireLogin())}>
        <Heart size={18} /> Apply to adopt {data.name}
      </button>
    )
  ) : !adopted ? (
    <button type="button" className="btn btn-amber btn-lg btn-block" onClick={() => (user ? setDialog("sponsor") : requireLogin())}>
      <HandCoins size={18} /> Sponsor {data.name}
    </button>
  ) : null;

  return (
    <div className="page animal-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>

      <div className="animal-layout">
        <div className="animal-main">
        {/* Hero gallery: the animal is the story, so the photo leads (61.8% of the width). */}
        <section className="animal-hero" aria-label={`Photos of ${data.name}`}>
          <div className="animal-hero-frame">
            {photos.length ? (
              <motion.img
                key={photos[photo]}
                src={photos[photo]}
                alt={`${data.name}, photo ${photo + 1} of ${photos.length}`}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
              />
            ) : (
              <span className="animal-hero-empty"><ImageOff size={40} /> No photos yet</span>
            )}
            <div className="animal-hero-badges">
              <StatusChip kind="animal" value={data.status} />
              {data.ai_verified ? <span className="chip chip-blue"><BadgeCheck size={11} /> Verified rescue</span> : null}
            </div>
            {photos.length > 1 ? <span className="animal-hero-count glass-dark">{photo + 1} / {photos.length}</span> : null}
          </div>
          {photos.length > 1 ? (
            <div className="animal-thumbs" role="group" aria-label="Choose a photo">
              {photos.map((src, index) => (
                <button key={src} type="button" aria-label={`Show photo ${index + 1}`} aria-pressed={index === photo} onClick={() => setPhoto(index)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <div className="animal-body">
          <SectionNav
            label={`Sections of ${data.name}'s profile`}
            sections={[
              { id: "about", label: "About" },
              ...(ownAnimal ? [{ id: "applications", label: `Applications${applicants.length ? ` (${applicants.length})` : ""}` }] : []),
              { id: "updates", label: `Updates${postCount ? ` (${postCount})` : ""}` },
              { id: "health", label: "Health" },
              { id: "story", label: "Rescue story" },
              ...(adoptable ? [{ id: "adopting", label: "Adopting" }] : []),
            ]}
          />

          <motion.section id="about" className="profile-section card card-pad" {...reveal}>
            <h2>Meet {data.name}</h2>
            <p className="animal-about">{data.description || `The rescue team hasn't written about ${data.name} yet.`}</p>
            <div className="animal-facts">
              {data.age !== null && data.age !== undefined ? <Fact tone="blue" icon={<Cake size={18} />} label="Age" value={`${data.age} ${data.age === 1 ? "year" : "years"}`} /> : null}
              {data.gender ? <Fact tone="coral" icon={<VenusAndMars size={18} />} label="Gender" value={data.gender} /> : null}
              {data.breed ? <Fact tone="green" icon={<PawPrint size={18} />} label="Breed" value={data.breed} /> : null}
              {data.color ? <Fact tone="amber" icon={<Palette size={18} />} label="Colour" value={data.color} /> : null}
              <Fact tone="emerald" icon={<Syringe size={18} />} label="Vaccinated" value={data.vaccinated ? "Yes" : "Not yet"} />
              <Fact tone="blue" icon={<CalendarHeart size={18} />} label="In care for" value={`${daysSince(data.created_at)} days`} />
              {data.microchip_id ? <Fact tone="navy" icon={<Cpu size={18} />} label="Microchip" value={data.microchip_id} /> : null}
              {data.application_count ? <Fact tone="green" icon={<Users size={18} />} label="Applications" value={data.application_count} /> : null}
            </div>
          </motion.section>

          {ownAnimal ? (
            <motion.section id="applications" className="profile-section card animal-applications" {...reveal}>
              <div className="profile-section-head">
                <h2>Adoption applications</h2>
                {applicants.length ? <Link to={applicationsLink} className="link small">Open in Applications</Link> : null}
              </div>
              {applications.loading && !applications.data ? (
                <Skeleton height={120} />
              ) : applicants.length ? (
                <ul className="animal-app-list">
                  {applicants.map((application) => (
                    <li key={application.id}>
                      <Link to={`${applicationsLink}&application=${application.id}`} className="animal-app-row">
                        <Avatar name={application.full_name} size={36} />
                        <span className="animal-app-text">
                          <span className="strong truncate">{application.full_name}</span>
                          <span className="small muted truncate">
                            {[application.city, application.home_type === "house" ? "House" : application.home_type === "apartment" ? "Apartment" : "", `applied ${formatRelativeTime(application.created_at)}`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <StatusChip kind="review" value={application.status} />
                        <ChevronRight size={16} className="animal-app-chevron" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  {adoptable
                    ? `No one has applied to adopt ${data.name} yet. Applications show up here as soon as they arrive.`
                    : adopted
                      ? `${data.name} has been adopted.`
                      : `${data.name} isn't open for adoption yet. Mark ${data.name} as adoptable in Animals to start receiving applications.`}
                </p>
              )}
            </motion.section>
          ) : null}

          <motion.section id="updates" className="profile-section" {...reveal}>
            <div className="profile-section-head">
              <h2>Updates</h2>
              <span className="muted small">From {data.organization?.name ?? "the rescue team"}</span>
            </div>
            {posts.data ? (
              posts.data.length ? (
                <UpdateGrid posts={posts.data} />
              ) : (
                <div className="card"><EmptyState title="No updates yet" message={`Follow ${data.name} to hear when the rescue team posts.`} /></div>
              )
            ) : (
              <Skeleton height={220} />
            )}
          </motion.section>

          <motion.section id="health" className="profile-section card card-pad animal-health" {...reveal}>
            <div className="profile-section-head">
              <h2><HeartPulse size={22} aria-hidden="true" /> Health</h2>
              {health ? <span className={`chip chip-${health.tone === "green" ? "green" : health.tone}`}>{health.label}</span> : null}
            </div>
            <p>{data.medical_info || "No medical notes shared yet."}</p>
            <p className="small muted">{data.vaccinated ? "Vaccinated." : "Vaccinations are still to be done."} Medical details are kept up to date by the rescue team.</p>
          </motion.section>

          <motion.section id="story" className="profile-section card card-pad" {...reveal}>
            <h2>{data.name}'s rescue story</h2>
            {rescue.data ? (
              <ol className="story">
                <li>
                  <span className="story-dot tone-coral" aria-hidden="true" />
                  <div>
                    <strong>Spotted and reported</strong>
                    <span className="small muted">{formatDate(rescue.data.created_at)}{rescue.data.area ? ` · ${rescue.data.area}` : ""}</span>
                    <p className="small">{rescue.data.description}</p>
                  </div>
                </li>
                {storySteps.map((step) => (
                  <li key={step.id}>
                    <span className="story-dot" aria-hidden="true" />
                    <div>
                      <strong>{step.status_label}</strong>
                      <span className="small muted">{formatDate(step.created_at)}</span>
                      <p className="small">{step.message}</p>
                    </div>
                  </li>
                ))}
                <li>
                  <span className="story-dot tone-green" aria-hidden="true" />
                  <div>
                    <strong>{adopted ? "Adopted" : adoptable ? "Ready for a home" : "Recovering"}</strong>
                    <span className="small muted">Now</span>
                  </div>
                </li>
              </ol>
            ) : (
              <p className="muted">The rescue story isn't available right now.</p>
            )}
            {caseId ? <Link className="link" to={`/case/${caseId}`}>See the full rescue case</Link> : null}
          </motion.section>

          {adoptable ? (
            <motion.section id="adopting" className="profile-section card card-pad animal-adopting" {...reveal}>
              <h2>Adopting {data.name}</h2>
              <ol className="adopt-steps">
                {ADOPTION_STEPS.map((step, index) => (
                  <li key={step.title}>
                    <span className="adopt-step-number" aria-hidden="true">{index + 1}</span>
                    <strong>{step.title}</strong>
                    <p className="small muted">{step.text}</p>
                  </li>
                ))}
              </ol>
              {data.adoption_info ? (
                <p className="small muted">
                  Questions? Call {data.adoption_info.phone || "the rescue team"}{data.adoption_info.email ? ` or email ${data.adoption_info.email}` : ""}.
                </p>
              ) : null}
            </motion.section>
          ) : null}
        </div>

        </div>

        {/* Action card: identity, funding and one clear next step. Sticky on desktop. */}
        <aside className="animal-card card" aria-label={`About ${data.name}`}>
          <div className="animal-card-head">
            <button type="button" className="sa-icon-btn animal-share" onClick={share} aria-label={`Share ${data.name}'s profile`}>
              <Share2 size={18} />
            </button>
            <h1 className="animal-name">{data.name}</h1>
            <p className="animal-subtitle">{subtitle || "Details coming soon"}</p>
            {data.area ? <p className="animal-where"><MapPin size={15} /> Found in {data.area}</p> : null}
          </div>

          {data.organization ? (
            <Link to={`/organizations/${data.organization.id}`} className="animal-org">
              <Avatar name={data.organization.name} src={data.organization.image} size={40} square />
              <span>
                <span className="small muted">Cared for by</span>
                <span className="strong row" style={{ gap: 4 }}>
                  {data.organization.name}
                  {data.organization.is_verified ? <BadgeCheck size={15} color="var(--green-700)" aria-label="Verified" /> : null}
                </span>
              </span>
            </Link>
          ) : null}

          {!adopted ? (
            <div className="animal-funding">
              <FundingMeter raised={data.raised_pkr ?? 0} goal={data.funding_goal_pkr ?? 0} caption={`raised for ${data.name}'s care`} supporters={data.sponsor_count} />
              {ownAnimal ? (
                <GoalEditor
                  goal={data.funding_goal_pkr ?? 0}
                  onSave={async (value) => {
                    try {
                      const updated = await updateAnimal(data.id, { funding_goal_pkr: value });
                      animal.setData({ ...data, ...updated });
                      toast({ title: "Care goal updated" });
                    } catch (error) {
                      toast({ title: "Couldn't save the goal", body: errorMessage(error), tone: "error" });
                    }
                  }}
                />
              ) : null}
            </div>
          ) : (
            <div className="alert alert-success"><Home size={18} /> {data.name} has found a forever home!</div>
          )}

          {primary}

          {canSupport && !ownAnimal ? (
            <div className="animal-secondary">
              {adoptable && !adopted ? (
                extras.my_sponsorship?.status === "pending" ? (
                  <span className="small muted animal-pending">Your pledge is being checked</span>
                ) : (
                  <button type="button" className="btn btn-amber" onClick={() => (user ? setDialog("sponsor") : requireLogin())}>
                    <HandCoins size={16} /> Sponsor
                  </button>
                )
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={toggleFollow} disabled={busy} aria-pressed={following}>
                {following ? <BellRing size={16} /> : <Bell size={16} />} {following ? "Following" : "Follow"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={message} disabled={busy}>
                <MessageSquare size={16} /> Message
              </button>
            </div>
          ) : null}

          <p className="animal-trust">
            <ShieldCheck size={15} aria-hidden="true" /> Every gift goes straight to {data.organization?.name ?? "the rescue team"}, who confirm the receipt before it counts.
          </p>
        </aside>
      </div>

      {/* Phones: keep the main action within thumb reach. */}
      {primary && canSupport && !ownAnimal && !extras.my_application ? (
        <div className="animal-mobile-cta glass">
          <div>
            <strong>{data.name}</strong>
            <span className="small muted">{data.funding_goal_pkr ? `${Math.min(100, Math.round(((data.raised_pkr ?? 0) / data.funding_goal_pkr) * 100))}% funded` : statusLabel("animal", data.status)}</span>
          </div>
          {primary}
        </div>
      ) : null}

      {dialog === "adopt" ? (
        <AdoptForm
          animalId={data.id}
          animalName={data.name}
          defaultName={displayNameOf(user)}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            animal.reload();
            toast({ title: "Application sent", body: `${data.organization?.name ?? "The rescue team"} will review it and get in touch.`, link: { to: "/my-applications", label: "Track it" } });
          }}
        />
      ) : null}
      {dialog === "sponsor" ? (
        <PledgeForm
          title={`Sponsor ${data.name}`}
          intro={`Your support pays for ${data.name}'s food, treatment and care.`}
          bank={data.donation_info}
          allowMonthly
          onClose={() => setDialog(null)}
          onSubmit={async (form) => {
            await sponsorAnimal(data.id, form);
            setDialog(null);
            animal.reload();
            toast({ title: "Thank you!", body: "The rescue team will confirm your receipt soon.", link: { to: "/my-applications", label: "Track it" } });
          }}
        />
      ) : null}
    </div>
  );
}

export default AnimalDetail;
