import { Link } from "react-router-dom";
import { ClipboardList, Smartphone } from "lucide-react";
import { getMyReports } from "../services/socialService";
import { useApi } from "../hooks/useApi";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, LoadingRows } from "../ui/States";
import CaseProgress from "../components/CaseProgress";
import { casePhoto, caseReference, caseTitle } from "../utils/cases";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import "./MyReports.css";

/** The cases a reporter has reported, with where each rescue is. */
function MyReports() {
  const reports = useApi(getMyReports);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>My reports</h1>
          <p>Follow the animals you reported, from the first alert to rescue.</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        <Smartphone size={18} /> <span>To report a new animal, use the StrayAid mobile app. It uses your camera and location.</span>
      </div>

      {reports.loading && !reports.data ? (
        <LoadingRows rows={3} height={140} />
      ) : reports.error && !reports.data ? (
        <ErrorState message={errorMessage(reports.error)} onRetry={reports.reload} />
      ) : reports.data?.length ? (
        <ul className="my-reports">
          {reports.data.map((item) => {
            const photo = casePhoto(item);
            return (
              <li key={item.id}>
                <Link to={`/case/${item.id}`} className="card my-report">
                  <span className="my-report-photo">{photo ? <img src={photo} alt="" /> : null}</span>
                  <span className="my-report-main">
                    <span className="row" style={{ flexWrap: "wrap" }}>
                      <span className="mono small muted">{caseReference(item)}</span>
                      <StatusChip kind="case" value={item.status} />
                    </span>
                    <span className="strong">{caseTitle(item)}</span>
                    <span className="small muted">
                      Reported {formatRelativeTime(item.created_at)}
                      {item.organization ? ` · ${item.organization.name} is handling it` : " · waiting for a rescue team"}
                    </span>
                    <CaseProgress status={item.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<ClipboardList size={22} />} title="No reports yet" message="Animals you report in the app show up here with their rescue progress." />
      )}
    </div>
  );
}

export default MyReports;
