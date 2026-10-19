import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, HandCoins } from "lucide-react";
import { getApplications, getDonations, getSponsorships, withdrawApplication } from "../services/fundingService";
import { useApi } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, LoadingRows } from "../ui/States";
import { formatDate, formatPkr } from "../utils/format";
import { errorMessage } from "../utils/errors";
import "./Funds.css";

const TABS = [
  { key: "adoptions", label: "Adoption applications" },
  { key: "sponsorships", label: "Sponsorships" },
  { key: "donations", label: "Shelter gifts" },
] as const;

const NEXT_STEP: Record<string, string> = {
  pending: "The rescue team is reviewing your application.",
  approved: "Approved! The rescue team will call you to arrange a visit.",
  rejected: "Not approved this time. Thank you for offering a home.",
  withdrawn: "You withdrew this application.",
};

/** A reporter's adoption applications, sponsorship pledges and shelter gifts. */
function MyApplications() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("adoptions");
  const applications = useApi(() => getApplications());
  const sponsorships = useApi(getSponsorships);
  const donations = useApi(getDonations);

  const withdraw = async (id: number, name: string) => {
    if (!window.confirm(`Withdraw your application for ${name}?`)) return;
    try {
      const updated = await withdrawApplication(id);
      applications.setData((current = []) => current.map((item) => (item.id === id ? { ...item, status: updated.status ?? "withdrawn" } : item)));
      toast({ title: "Application withdrawn" });
    } catch (error) {
      toast({ title: "Couldn't withdraw", body: errorMessage(error), tone: "error" });
    }
  };

  const source = tab === "adoptions" ? applications : tab === "sponsorships" ? sponsorships : donations;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>Adopt & sponsor</h1>
          <p>Track your adoption applications and the receipts you've sent.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-header fund-tabs-head">
          <div className="tabs" role="tablist">
            {TABS.map((item) => (
              <button key={item.key} type="button" role="tab" className="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {source.loading && !source.data ? (
          <div className="card-body"><LoadingRows rows={3} height={60} /></div>
        ) : source.error && !source.data ? (
          <ErrorState message={errorMessage(source.error)} onRetry={source.reload} />
        ) : tab === "adoptions" ? (
          applications.data?.length ? (
            <ul className="fund-list">
              {applications.data.map((item) => (
                <li key={item.id} className="fund-row">
                  <span className="fund-receipt">{item.animal.image ? <img src={item.animal.image} alt="" /> : null}</span>
                  <div className="fund-row-main">
                    <Link to={`/animals/${item.animal.id}`} className="strong">{item.animal.name}</Link>
                    <span className="small muted">Applied {formatDate(item.created_at)} · {NEXT_STEP[item.status]}</span>
                  </div>
                  <StatusChip kind="review" value={item.status} />
                  {item.status === "pending" ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => withdraw(item.id, item.animal.name)}>Withdraw</button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FileText size={22} />} title="No applications yet" message="Animals ready for adoption have an Apply button." action={<Link to="/animals/browse?status=adoptable" className="btn btn-primary btn-sm">Find an animal</Link>} />
          )
        ) : tab === "sponsorships" ? (
          sponsorships.data?.length ? (
            <ul className="fund-list">
              {sponsorships.data.map((item) => (
                <li key={item.id} className="fund-row">
                  <span className="fund-receipt">{item.animal.image ? <img src={item.animal.image} alt="" /> : null}</span>
                  <div className="fund-row-main">
                    <Link to={`/animals/${item.animal.id}`} className="strong">{item.animal.name}</Link>
                    <span className="small muted">{formatDate(item.created_at)}{item.monthly ? " · monthly" : ""}</span>
                  </div>
                  <span className="fund-amount">{formatPkr(item.amount_pkr)}</span>
                  <StatusChip kind="review" value={item.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<HandCoins size={22} />} title="No sponsorships yet" message="Sponsor an animal to help pay for its care." />
          )
        ) : donations.data?.length ? (
          <ul className="fund-list">
            {donations.data.map((item) => (
              <li key={item.id} className="fund-row">
                <div className="fund-row-main">
                  <Link to={`/organizations/${item.organization.id}`} className="strong">{item.organization.name}</Link>
                  <span className="small muted">Medical supplies · {formatDate(item.created_at)}</span>
                </div>
                <span className="fund-amount">{formatPkr(item.amount_pkr)}</span>
                <StatusChip kind="review" value={item.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<HandCoins size={22} />} title="No gifts yet" message="You can give to a shelter's medical supplies from its profile." />
        )}
      </section>
    </div>
  );
}

export default MyApplications;
