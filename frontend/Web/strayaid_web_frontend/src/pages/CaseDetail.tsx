import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { acceptCase, getCase, updateCaseStatus } from "../services/platformService";
import type { Case } from "../types/platform";
import { statusBadgeClass } from "../utils/status";
import "../styles/Portal.css";

function CaseDetail() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<Case | null>(null);

  useEffect(() => {
    getCase(caseId).then(setCaseItem).catch(() => setCaseItem(null));
  }, [caseId]);

  const handleAccept = async () => {
    const updated = await acceptCase(caseId);
    setCaseItem(updated);
  };

  const handleStatusChange = async (status: string) => {
    const updated = await updateCaseStatus(caseId, status);
    setCaseItem(updated);
    if (status === "rescued") {
      navigate(`/animals?caseId=${caseId}`);
    }
  };

  if (!caseItem) {
    return <div className="empty-state">Case not found or unavailable for this organization.</div>;
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Case #{caseItem.id}</h1>
          <p>{caseItem.description}</p>
        </div>
        <span className={statusBadgeClass(caseItem.status)}>{caseItem.status}</span>
      </div>

      <section className="panel-card">
        <p className="meta-line">Reported: {new Date(caseItem.created_at).toLocaleString()}</p>
        <div className="case-actions">
          {!caseItem.organization && <button className="primary-btn" onClick={handleAccept}>Accept Case</button>}
          {caseItem.organization && ["in_progress", "rescued", "closed"].map((status) => (
            <button key={status} className="secondary-btn" onClick={() => handleStatusChange(status)}>
              Mark {status.replace("_", " ")}
            </button>
          ))}
          {caseItem.status === "rescued" && <Link className="primary-btn" to={`/animals?caseId=${caseItem.id}`}>Create Animal Profile</Link>}
        </div>
      </section>

      <section className="panel-card">
        <h2>Attached Reports</h2>
        <div className="stacked-feed">
          {caseItem.reports.map((report) => (
            <article className="feed-card" key={report.id}>
              {report.image ? <img className="card-media report-media-fit" src={report.image} alt="Case report" /> : null}
              <p>{report.description}</p>
              <p className="meta-line">{report.user_email ?? "Reporter"} - {new Date(report.created_at).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CaseDetail;

