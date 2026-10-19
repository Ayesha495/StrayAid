import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, HandCoins, Receipt, Wallet, X } from "lucide-react";
import { getDonations, getOrganizationStats, getSponsorships, reviewDonation, reviewSponsorship } from "../services/fundingService";
import { getOrganizationAnimals } from "../services/platformService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import StatusChip from "../ui/StatusChip";
import FundingMeter from "../components/FundingMeter";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "../ui/States";
import { formatDate, formatPkr } from "../utils/format";
import { formatRelativeTime } from "../utils/time";
import { errorMessage } from "../utils/errors";
import type { ShelterDonation, Sponsorship } from "../types/api";
import "./Funds.css";

/** Sponsorships and shelter donations share one queue on this page. */
type FundItem = {
  key: string;
  kind: "sponsorship" | "donation";
  id: number;
  who: string;
  what: string;
  animalId?: number;
  amount: number;
  monthly: boolean;
  receipt: string | null;
  status: "pending" | "confirmed" | "rejected";
  created_at: string;
};

const fromSponsorship = (item: Sponsorship): FundItem => ({
  key: `s${item.id}`,
  kind: "sponsorship",
  id: item.id,
  who: item.sponsor_name || "A supporter",
  what: `Sponsoring ${item.animal.name}`,
  animalId: item.animal.id,
  amount: item.amount_pkr,
  monthly: item.monthly,
  receipt: item.receipt,
  status: item.status,
  created_at: item.created_at,
});

const fromDonation = (item: ShelterDonation): FundItem => ({
  key: `d${item.id}`,
  kind: "donation",
  id: item.id,
  who: item.donor_name,
  what: "Shelter medical supplies",
  amount: item.amount_pkr,
  monthly: false,
  receipt: item.receipt,
  status: item.status,
  created_at: item.created_at,
});

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
};

function FundRow({ item, onReview, onZoom, busy }: { item: FundItem; onReview?: (item: FundItem, status: "confirmed" | "rejected") => void; onZoom: (item: FundItem) => void; busy: boolean }) {
  return (
    <li className="fund-row">
      <button type="button" className="fund-receipt" onClick={() => onZoom(item)} disabled={!item.receipt} aria-label={item.receipt ? `View receipt from ${item.who}` : "No receipt"}>
        {item.receipt ? <img src={item.receipt} alt="" loading="lazy" /> : <Receipt size={20} />}
      </button>
      <div className="fund-row-main">
        <span className="strong">{item.who}</span>
        <span className="small muted">
          {item.animalId ? <Link className="link" to={`/animals/${item.animalId}`}>{item.what}</Link> : item.what}
          {item.monthly ? " · monthly" : ""} · {formatRelativeTime(item.created_at)}
        </span>
      </div>
      <span className="fund-amount">{formatPkr(item.amount)}</span>
      {onReview && item.status === "pending" ? (
        <div className="fund-actions">
          <button type="button" className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => onReview(item, "rejected")}>
            <X size={14} /> Reject
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onReview(item, "confirmed")}>
            <Check size={14} /> Confirm
          </button>
        </div>
      ) : (
        <StatusChip kind="review" value={item.status} />
      )}
    </li>
  );
}

function Funds() {
  const toast = useToast();
  const { organization } = useShell();
  const sponsorships = useApi(getSponsorships);
  const donations = useApi(getDonations);
  const animals = useApi(getOrganizationAnimals);
  const stats = useApi(() => (organization ? getOrganizationStats(organization.id) : Promise.resolve(null)), String(organization?.id ?? ""));
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [zoomed, setZoomed] = useState<FundItem | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const items = useMemo(
    () => [...(sponsorships.data ?? []).map(fromSponsorship), ...(donations.data ?? []).map(fromDonation)]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [sponsorships.data, donations.data],
  );
  const pending = items.filter((item) => item.status === "pending");
  const history = items.filter((item) => item.status !== "pending");
  const monthStart = startOfMonth();
  const confirmedThisMonth = items
    .filter((item) => item.status === "confirmed" && Date.parse(item.created_at) >= monthStart)
    .reduce((sum, item) => sum + item.amount, 0);
  const confirmedTotal = items.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + item.amount, 0);

  const raisedByAnimal = useMemo(() => {
    const totals = new Map<number, number>();
    (sponsorships.data ?? []).filter((item) => item.status === "confirmed").forEach((item) => {
      totals.set(item.animal.id, (totals.get(item.animal.id) ?? 0) + item.amount_pkr);
    });
    return totals;
  }, [sponsorships.data]);

  const review = async (item: FundItem, status: "confirmed" | "rejected") => {
    setBusyKey(item.key);
    try {
      if (item.kind === "sponsorship") {
        const updated = await reviewSponsorship(item.id, status);
        sponsorships.setData((current = []) => current.map((row) => (row.id === item.id ? { ...row, ...updated, status } : row)));
      } else {
        await reviewDonation(item.id, status);
        donations.setData((current = []) => current.map((row) => (row.id === item.id ? { ...row, status } : row)));
      }
      toast({
        title: status === "confirmed" ? `${formatPkr(item.amount)} confirmed` : "Receipt rejected",
        body: status === "confirmed" ? `${item.who} has been thanked.` : `${item.who} has been asked to message you.`,
      });
      setZoomed(null);
      stats.reload();
    } catch (error) {
      toast({ title: "Couldn't save that", body: errorMessage(error), tone: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  const loading = (sponsorships.loading && !sponsorships.data) || (donations.loading && !donations.data);
  const failed = (sponsorships.error && !sponsorships.data) || (donations.error && !donations.data);
  const fund = stats.data?.fund;
  const list = tab === "pending" ? pending : history;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Funds</h1>
          <p>Check transfer receipts for sponsorships and shelter donations. Only confirmed money counts towards goals.</p>
        </div>
      </div>

      <div className="fund-stats">
        <div className="card sa-stat tint-coral">
          <span className="sa-stat-label"><span className="stat-chip"><Receipt size={16} /></span> Receipts to check</span>
          <span className="stat-value">{loading ? "–" : pending.length}</span>
          <span className="stat-foot">{formatPkr(pending.reduce((sum, item) => sum + item.amount, 0))} waiting</span>
        </div>
        <div className="card sa-stat tint-green">
          <span className="sa-stat-label"><span className="stat-chip"><HandCoins size={16} /></span> Confirmed this month</span>
          <span className="stat-value">{loading ? "–" : formatPkr(confirmedThisMonth)}</span>
          <span className="stat-foot">{formatPkr(confirmedTotal)} confirmed in total</span>
        </div>
        <div className="card sa-stat tint-amber">
          <span className="sa-stat-label"><span className="stat-chip"><Wallet size={16} /></span> {fund ? `${fund.month} supply fund` : "Supply fund"}</span>
          {fund ? (
            <>
              <span className="stat-value">{fund.percent}%</span>
              <span className="progress"><span style={{ width: `${fund.percent}%` }} /></span>
              <span className="stat-foot">{formatPkr(fund.raised_pkr)} of {formatPkr(fund.goal_pkr)}</span>
            </>
          ) : (
            <Skeleton height={48} />
          )}
        </div>
      </div>

      <div className="fund-grid">
        <section className="card">
          <div className="card-header fund-tabs-head">
            <div className="tabs" role="tablist">
              <button type="button" role="tab" className="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>
                To check ({pending.length})
              </button>
              <button type="button" role="tab" className="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
                History ({history.length})
              </button>
            </div>
          </div>
          {loading ? (
            <div className="card-body"><LoadingRows rows={4} height={60} /></div>
          ) : failed ? (
            <ErrorState message={errorMessage(sponsorships.error ?? donations.error)} onRetry={() => { sponsorships.reload(); donations.reload(); }} />
          ) : list.length ? (
            <ul className="fund-list">
              {list.map((item) => (
                <FundRow key={item.key} item={item} onReview={review} onZoom={setZoomed} busy={busyKey === item.key} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Receipt size={22} />}
              title={tab === "pending" ? "All receipts checked" : "No history yet"}
              message={tab === "pending" ? "New sponsorship and donation receipts will appear here." : "Confirmed and rejected receipts are kept here."}
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Care funding</h3>
              <p className="small muted">Confirmed money against each animal's care goal.</p>
            </div>
          </div>
          {animals.data ? (
            animals.data.length ? (
              <ul className="fund-goals">
                {animals.data.filter((animal) => animal.status !== "adopted").map((animal) => (
                  <li key={animal.id}>
                    <Link to={`/animals/${animal.id}`} className="strong">{animal.name}</Link>
                    <FundingMeter raised={animal.raised_pkr ?? raisedByAnimal.get(animal.id) ?? 0} goal={animal.funding_goal_pkr ?? 0} size="sm" supporters={animal.sponsor_count} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No animals yet" />
            )
          ) : (
            <div className="card-body"><LoadingRows rows={3} height={44} /></div>
          )}
        </section>
      </div>

      {zoomed ? (
        <Modal
          title={`Receipt from ${zoomed.who}`}
          onClose={() => setZoomed(null)}
          footer={zoomed.status === "pending" ? (
            <>
              <button type="button" className="btn btn-danger-outline" disabled={busyKey === zoomed.key} onClick={() => review(zoomed, "rejected")}>Reject</button>
              <button type="button" className="btn btn-primary" disabled={busyKey === zoomed.key} onClick={() => review(zoomed, "confirmed")}>Confirm {formatPkr(zoomed.amount)}</button>
            </>
          ) : undefined}
        >
          <div className="stack">
            <p className="small muted">{zoomed.what} · {formatPkr(zoomed.amount)}{zoomed.monthly ? " monthly" : ""} · {formatDate(zoomed.created_at)}</p>
            {zoomed.receipt ? <img src={zoomed.receipt} alt={`Transfer receipt from ${zoomed.who}`} className="fund-receipt-large" /> : null}
            <p className="small">Check the amount and that the transfer reached your account before confirming.</p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default Funds;
