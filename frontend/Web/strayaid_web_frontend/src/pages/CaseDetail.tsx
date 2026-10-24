import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Clock, ExternalLink, MapPin, MessageSquare, PawPrint, Send, Gauge } from "lucide-react";
import { acceptCase, getCase, getOrganizationProfile, updateCaseStatus } from "../services/platformService";
import { addCaseNote, getCaseUpdates, getPublicCase } from "../services/caseService";
import { startConversation } from "../services/chatService";
import type { Case, Organization, Report } from "../types/platform";
import type { CaseUpdate, PublicCase } from "../types/api";
import { chipStyle } from "../utils/statusStyles";
import { NEXT_STATUS_ACTION, nextStatuses } from "../utils/cases";
import { errorMessage } from "../utils/errors";
import { formatDateTime, initialsOf } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import ScoreBadge from "../ui/ScoreBadge";
import ScoreBreakdown from "../components/ScoreBreakdown";
import CaseProgress from "../components/CaseProgress";
import ServiceAreaMap from "../components/ServiceAreaMap";
import "../styles/Portal.css";
import "./CaseDetail.css";

/** What the next step means, so the team knows what pressing the button tells everyone. */
const NEXT_HINT: Record<string, string> = {
  assigned: "Tell the reporter a responder is on it.",
  in_progress: "Your team is heading to the animal.",
  rescued: "The animal is safe. Next you'll create its profile.",
  adoption: "Recovered and ready to meet families.",
  closed: "No further action. This can't be undone.",
};

function CaseDetail() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [publicCase, setPublicCase] = useState<PublicCase | null>(null);
  const [updates, setUpdates] = useState<CaseUpdate[]>([]);
  const [photo, setPhoto] = useState(0);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCase(caseId).then(setCaseItem).catch(() => setCaseItem(null)).finally(() => setLoaded(true));
    getPublicCase(caseId).then(setPublicCase).catch(() => setPublicCase(null));
    getCaseUpdates(caseId).then(setUpdates).catch(() => setUpdates([]));
  }, [caseId]);

  useEffect(() => {
    getOrganizationProfile().then(setOrganization).catch(() => setOrganization(null));
  }, []);

  const refreshHistory = () => {
    getCaseUpdates(caseId).then(setUpdates).catch(() => {});
    getPublicCase(caseId).then(setPublicCase).catch(() => {});
  };

  const handleAccept = async () => {
    try {
      const updated = await acceptCase(caseId);
      setCaseItem(updated);
      refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleStatusChange = async (status: string) => {
    if (status === "closed" && !window.confirm("Close this case? A closed case can't be reopened.")) {
      return;
    }
    try {
      const updated = await updateCaseStatus(caseId, status);
      setCaseItem(updated);
      refreshHistory();
      if (status === "rescued") {
        navigate(`/animals?caseId=${caseId}`);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const handleNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    setPosting(true);
    try {
      await addCaseNote(caseId, note.trim());
      setNote("");
      refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPosting(false);
    }
  };

  const messageReporter = async (report: Report) => {
    try {
      const conversation = await startConversation({ case_id: Number(caseId), member_id: report.user });
      navigate(`/messages/${conversation.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  if (!loaded) {
    return <div className="cd-loading" aria-busy="true">Loading case…</div>;
  }
  if (!caseItem) {
    return <div className="empty-state">Case not found or unavailable for this organization.</div>;
  }

  // Only the next steps of the rescue are offered: reported → assigned → in progress → rescued → adoption / closed.
  const isMine = Boolean(organization && caseItem.organization?.id === organization.id);
  const options = isMine ? nextStatuses(caseItem.status) : [];
  const forward = options.filter((status) => status !== "closed");
  const canClose = options.includes("closed");
  const photos = caseItem.reports.filter((report) => report.image);
  const shown = photos[Math.min(photo, photos.length - 1)];
  const severity = caseItem.severity ?? caseItem.reports.find((report) => report.severity)?.severity;
  const title = caseItem.title || `Case #${caseItem.id}`;

  return (
    <div className="portal-page cd">
      <Link to="/cases" className="cd-back"><ArrowLeft size={16} /> Rescue board</Link>

      <header className="cd-head">
        <div>
          <p className="cd-ref">{caseItem.reference || `#${caseItem.id}`} · reported {formatRelativeTime(caseItem.created_at)}</p>
          <h1>{title}</h1>
          <div className="cd-chips">
            <span className={`chip ${chipStyle("case", caseItem.status).className}`}>{caseItem.status_label || caseItem.status.replace("_", " ")}</span>
            <ScoreBadge score={caseItem.confidence_score} />
            {severity ? <span className={`chip ${chipStyle("severity", severity).className}`}>{chipStyle("severity", severity).label} severity</span> : null}
            {caseItem.area ? <span className="chip chip-slate"><MapPin size={11} /> {caseItem.area}</span> : null}
          </div>
        </div>
      </header>

      {error ? <div className="alert alert-error cd-alert" role="alert">{error}</div> : null}

      <div className="cd-layout">
        <div className="cd-main">
          {/* Photos first: the team decides faster when they can see the animal. */}
          <section className="panel-card cd-gallery" aria-label="Report photos">
            {shown ? (
              <>
                <div className="cd-photo">
                  <img className="cd-photo-blur" src={shown.image} alt="" aria-hidden="true" />
                  <img src={shown.image} alt={`Reported: ${shown.description}`} />
                  <span className="cd-photo-count"><Camera size={13} /> {photos.length} photo{photos.length === 1 ? "" : "s"}</span>
                </div>
                {photos.length > 1 ? (
                  <div className="cd-thumbs" role="group" aria-label="Choose a photo">
                    {photos.map((report, index) => (
                      <button
                        key={report.id}
                        type="button"
                        className="cd-thumb"
                        aria-pressed={index === photo}
                        aria-label={`Photo ${index + 1}`}
                        onClick={() => setPhoto(index)}
                      >
                        <img src={report.image} alt="" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="cd-photo cd-photo-empty"><PawPrint size={28} /> No photos with this report</div>
            )}
          </section>

          <section className="panel-card">
            <h2 className="cd-h2">What was reported</h2>
            <p className="cd-description">{caseItem.description}</p>
          </section>

          <section className="panel-card">
            <h2 className="cd-h2">Reporters <span className="cd-count">{caseItem.reports.length}</span></h2>
            <ul className="cd-reports">
              {caseItem.reports.map((report) => (
                <li key={report.id} className="cd-report">
                  <span className="cd-avatar" aria-hidden="true">{initialsOf(report.user_email?.split("@")[0])}</span>
                  <div className="cd-report-body">
                    <p className="cd-report-who">
                      <strong>{report.user_email ?? "Reporter"}</strong>
                      <span>{formatDateTime(report.created_at)}</span>
                    </p>
                    <p>{report.description}</p>
                  </div>
                  {isMine && report.user ? (
                    <button type="button" className="secondary-btn cd-msg" onClick={() => messageReporter(report)}>
                      <MessageSquare size={14} /> Message
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel-card">
            <h2 className="cd-h2">Case history</h2>
            {isMine && caseItem.status !== "closed" ? (
              <form className="cd-note" onSubmit={handleNote}>
                <label htmlFor="case-note" className="sr-only">Post an update for the reporter and followers</label>
                <textarea
                  id="case-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Post an update for the reporter and followers, e.g. Team reached the location."
                />
                <button type="submit" className="primary-btn" disabled={posting || !note.trim()}>
                  <Send size={14} /> {posting ? "Posting…" : "Post"}
                </button>
              </form>
            ) : null}
            {updates.length ? (
              <ol className="cd-timeline">
                {updates.map((update) => (
                  <li key={update.id} className={update.status ? "is-status" : "is-note"}>
                    <span className="cd-dot" aria-hidden="true" />
                    <div>
                      <p className="cd-timeline-head">
                        <strong>{update.status ? update.status_label : update.author_name || "Update"}</strong>
                        <span><Clock size={12} /> {formatDateTime(update.created_at)}</span>
                      </p>
                      <p>{update.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="meta-line">No updates yet.</p>
            )}
          </section>
        </div>

        <aside className="cd-side">
          <section className="panel-card cd-status">
            <h2 className="cd-h2">Rescue progress</h2>
            <CaseProgress status={caseItem.status} />
            {caseItem.organization && !isMine ? <p className="meta-line">Handled by {caseItem.organization.name}.</p> : null}

            {!caseItem.organization ? (
              <div className="cd-next">
                <button className="primary-btn cd-next-btn" onClick={handleAccept}>Accept case</button>
                <p className="meta-line">Your team takes this rescue and the reporter is told.</p>
              </div>
            ) : null}

            {forward.map((status) => (
              <div className="cd-next" key={status}>
                <button className="primary-btn cd-next-btn" onClick={() => handleStatusChange(status)}>{NEXT_STATUS_ACTION[status]}</button>
                <p className="meta-line">{NEXT_HINT[status]}</p>
              </div>
            ))}
            {isMine && caseItem.status === "rescued" ? (
              <Link className="secondary-btn cd-next-btn" to={`/animals?caseId=${caseItem.id}`}><PawPrint size={14} /> Create animal profile</Link>
            ) : null}
            {canClose ? (
              <button type="button" className="cd-close" onClick={() => handleStatusChange("closed")}>Close case</button>
            ) : null}
          </section>

          <section className="panel-card cd-location">
            <h2 className="cd-h2">Location</h2>
            <ServiceAreaMap latitude={caseItem.latitude} longitude={caseItem.longitude} label={`Map of where case ${caseItem.id} was reported`} />
            <a
              className="cd-directions"
              href={`https://www.google.com/maps/dir/?api=1&destination=${caseItem.latitude},${caseItem.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} /> Directions in Google Maps
            </a>
          </section>

          <section className="panel-card">
            <h2 className="cd-h2"><Gauge size={16} className="cd-ai-icon" /> AI priority</h2>
            {publicCase ? (
              <ScoreBreakdown score={publicCase.confidence_score} ai={publicCase.ai} />
            ) : (
              <p className="meta-line">The score breakdown isn't available right now.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default CaseDetail;
