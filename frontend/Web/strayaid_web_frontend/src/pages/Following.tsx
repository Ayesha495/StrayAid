import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Heart } from "lucide-react";
import { getPublicAnimals } from "../services/platformService";
import { followAnimal, followOrganization, getDirectory, getMyFollows } from "../services/socialService";
import { useApi } from "../hooks/useApi";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import AnimalTile from "../components/AnimalTile";
import { errorMessage } from "../utils/errors";
import "../components/AnimalTile.css";
import "./Organizations.css";

/** The animals and rescue teams a person follows. */
function Following() {
  const toast = useToast();
  const follows = useApi(getMyFollows);
  const animals = useApi(() => getPublicAnimals());
  const directory = useApi(getDirectory);

  const followedAnimals = useMemo(
    () => (animals.data ?? []).filter((animal) => follows.data?.followed_animals.includes(animal.id)),
    [animals.data, follows.data],
  );
  const followedOrganizations = useMemo(
    () => (directory.data ?? []).filter((item) => follows.data?.followed_organizations.includes(item.id)),
    [directory.data, follows.data],
  );

  const unfollow = async (kind: "animal" | "organization", id: number, name: string) => {
    try {
      await (kind === "animal" ? followAnimal(id, false) : followOrganization(id, false));
      follows.setData((current = { followed_animals: [], followed_organizations: [] }) => ({
        followed_animals: current.followed_animals.filter((item) => kind !== "animal" || item !== id),
        followed_organizations: current.followed_organizations.filter((item) => kind !== "organization" || item !== id),
      }));
      toast({ title: `Unfollowed ${name}` });
    } catch (error) {
      toast({ title: "Couldn't unfollow", body: errorMessage(error), tone: "error" });
    }
  };

  const loading = !follows.data || !animals.data || !directory.data;
  if (follows.error && !follows.data) {
    return <div className="page"><ErrorState message={errorMessage(follows.error)} onRetry={follows.reload} /></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Following</h1>
          <p>You hear about status changes and new posts from these.</p>
        </div>
      </div>

      <h2 className="section-title">Animals</h2>
      {loading ? (
        <div className="animal-grid"><Skeleton height={280} /><Skeleton height={280} /></div>
      ) : followedAnimals.length ? (
        <div className="animal-grid">
          {followedAnimals.map((animal) => (
            <AnimalTile
              key={animal.id}
              animal={animal}
              showOrganization
              actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => unfollow("animal", animal.id, animal.name)}>Unfollow</button>}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={<Heart size={22} />} title="Not following any animals" message="Follow an animal to get its updates." action={<Link to="/animals/browse" className="btn btn-primary btn-sm">Browse animals</Link>} />
        </div>
      )}

      <h2 className="section-title">Rescue teams</h2>
      {loading ? (
        <Skeleton height={120} />
      ) : followedOrganizations.length ? (
        <div className="org-grid">
          {followedOrganizations.map((item) => (
            <div key={item.id} className="card org-card">
              <Link to={`/organizations/${item.id}`} className="org-card-head">
                <Avatar name={item.name} src={item.image} size={48} square />
                <span className="strong row" style={{ gap: 4 }}>
                  {item.name}
                  {item.is_verified ? <BadgeCheck size={15} color="var(--green-700)" aria-label="Verified" /> : null}
                </span>
              </Link>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => unfollow("organization", item.id, item.name)}>Unfollow</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState title="Not following any rescue teams" action={<Link to="/organizations" className="btn btn-primary btn-sm">Find rescue teams</Link>} />
        </div>
      )}
    </div>
  );
}

export default Following;
