import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, MessageSquare, PawPrint } from "lucide-react";
import { getCaseReports, getCaseUpdates, getPublicCase } from "../services/caseService";
import { setKeepUpdated } from "../services/socialService";
import { startConversation } from "../services/chatService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import ScoreBadge from "../ui/ScoreBadge";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "../ui/States";
import CaseProgress from "../components/CaseProgress";
import ScoreBreakdown from "../components/ScoreBreakdown";
import { capitalize, formatDateTime } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import "./PublicCase.css";

/** A rescue case as reporters and the public see it: progress, history and the AI score. */
function PublicCase() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isOrganization } = useShell();
  const detail = useApi(() => getPublicCase(caseId), `${caseId}:${user?.id ?? ""}`);
  const updates = useApi(() => getCaseUpdates(caseId), caseId);
  const reports = useApi(() => getCaseReports(caseId), caseId);
  const [busy, setBusy] = useState(false);

  const item = detail.data;
  if (detail.error && !item) {
    return <div className="page"><ErrorState title="Case not found" message={errorMessage(detail.error)} onRetry={detail.reload} /></div>;
  }
  if (!item) {
    return <div className="page"><Skeleton height={36} width={280} style={{ marginBottom: 16 }} /><LoadingRows rows={2} height={220} /></div>;
  }

  const requireLogin = () => navigate("/login", { state: { from: location.pathname } });

  const toggleUpdates = async () => {
    if (!user) return requireLogin();
    setBusy(true);
    try {
      await setKeepUpdated(item.id, !item.keep_updated);
      detail.setData({ ...item, keep_updated: !item.keep_updated });
      toast({ title: item.keep_updated ? "You won't get updates" : "You'll get updates on this case" });
    } catch (error) {
      toast({ title: "Couldn't update", body: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    if (!user) return requireLogin();
    setBusy(true);
    try {
      const conversation = await startConversation({ case_id: item.id });
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      toast({ title: "Couldn't open the chat", body: errorMessage(error), tone: "error" });
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>

      <div className="page-header case-header">
        <div>
          <div className="row" style={{ flexWrap: "wrap", marginBottom: 6 }}>
            <span className="mono muted">{item.reference}</span>
            <StatusChip kind="case" value={item.status} />
            <StatusChip kind="severity" value={item.severity} />
            <ScoreBadge score={item.confidence_score} />
            {item.is_reporter ? <span className="chip chip-green">You reported this</span> : null}
          </div>
          <h1>{item.title}</h1>
          <p>Reported {formatRelativeTime(item.created_at)}{item.area ? ` in ${item.area}` : ""}</p>
        </div>
        {!isOrganization ? (
          <div className="page-actions">
            <button type="button" className="btn btn-secondary" onClick={toggleUpdates} disabled={busy} aria-pressed={item.keep_updated}>
              {item.keep_updated ? <BellOff size={16} /> : <Bell size={16} />} {item.keep_updated ? "Stop updates" : "Keep me updated"}
            </button>
            {item.organization ? (
              <button type="button" className="btn btn-primary" onClick={message} disabled={busy}><MessageSquare size={16} /> Message the team</button>
            ) : null}
          </div>
        ) : (
          <div className="page-actions"><Link to={`/cases/${item.id}`} className="btn btn-secondary">Open on rescue board</Link></div>
        )}
      </div>

      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <CaseProgress status={item.status} />
      </section>

      {item.animal ? (
        <Link to={`/animals/${item.animal.id}`} className="alert alert-success case-callout">
          <PawPrint size={18} /> <span>Rescued! Meet <strong>{item.animal.name}</strong> and follow their recovery.</span>
        </Link>
      ) : null}

      <div className="case-grid">
        <div className="stack">
          <section className="card">
            {item.image ? <div className="case-gallery"><img src={item.image} alt={item.title} className="case-gallery-main" /></div> : null}
            <div className="card-body stack" style={{ gap: 8 }}>
              <h3>What was reported</h3>
              <p>{item.description}</p>
              <p className="small muted">{[capitalize(item.species), item.area].filter(Boolean).join(" · ")}</p>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h3>Updates</h3></div>
            <div className="card-body">
              {updates.data ? (
                updates.data.length ? (
                  <ol className="timeline">
                    {updates.data.map((update) => (
                      <li key={update.id} className={update.status ? "is-status" : undefined}>
                        <div className="timeline-head">
                          <span className="strong">{update.status ? update.status_label : update.author_name || "Update"}</span>
                          <span className="small muted">{formatDateTime(update.created_at)}</span>
                        </div>
                        <p className="small">{update.message}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState title="No updates yet" message="You'll see the rescue team's progress here." />
                )
              ) : (
                <LoadingRows rows={3} height={44} />
              )}
            </div>
          </section>

          {reports.data && reports.data.length > 1 ? (
            <section className="card">
              <div className="card-header"><h3>Reports ({reports.data.length})</h3></div>
              <ul className="case-reports">
                {reports.data.map((report) => (
                  <li key={report.id} className="case-report">
                    {report.image ? <img src={report.image} alt="" className="case-report-photo" /> : <span className="case-report-photo" />}
                    <div className="case-report-body">
                      <span className="strong small">{report.is_mine ? "You" : report.reporter}</span>
                      <p className="small">{report.description}</p>
                      <span className="small muted">{formatRelativeTime(report.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header"><h3>Rescue team</h3></div>
            <div className="card-body">
              {item.organization ? (
                <Link to={`/organizations/${item.organization.id}`} className="row" style={{ gap: 12 }}>
                  <Avatar name={item.organization.name} src={item.organization.image} size={44} square />
                  <span>
                    <span className="strong" style={{ display: "block" }}>{item.organization.name}</span>
                    <span className="small muted">{item.organization.city}</span>
                  </span>
                </Link>
              ) : (
                <p className="small muted">Nearby rescue teams have been alerted. You'll be told when one takes the case.</p>
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-header"><h3>AI priority</h3></div>
            <div className="card-body"><ScoreBreakdown score={item.confidence_score} ai={item.ai} /></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default PublicCase;
