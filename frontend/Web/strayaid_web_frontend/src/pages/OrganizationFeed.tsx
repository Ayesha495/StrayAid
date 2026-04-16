import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FeedContent from "../components/FeedContent";
import { getPublicAnimals, getPublicFeed } from "../services/platformService";
import type { Animal, Post } from "../types/platform";

function OrganizationFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    getPublicFeed().then(setPosts).catch(() => setPosts([]));
    getPublicAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  return (
    <FeedContent
      animals={animals}
      posts={posts}
      selectedAnimal={selectedAnimal}
      onSelectAnimal={setSelectedAnimal}
      action={<Link className="primary-btn" to="/dashboard">Back To Dashboard</Link>}
    />
  );
}

export default OrganizationFeed;
