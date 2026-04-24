import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AuthenticatedShell from "../components/AuthenticatedShell";
import FeedContent from "../components/FeedContent";
import { useCurrentUser } from "../services/authSevice";
import { getPublicAnimals, getPublicFeed } from "../services/platformService";
import type { Animal, Post } from "../types/platform";
import "../styles/Portal.css";

function PostFeed() {
  const currentUser = useCurrentUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    getPublicFeed().then(setPosts).catch(() => setPosts([]));
    getPublicAnimals().then(setAnimals).catch(() => setAnimals([]));
  }, []);

  if (currentUser?.role === "organization") {
    return <Navigate to="/org/feed" replace />;
  }

  if (currentUser) {
    return (
      <AuthenticatedShell>
          <FeedContent
            animals={animals}
            posts={posts}
            selectedAnimal={selectedAnimal}
            onSelectAnimal={setSelectedAnimal}
            action={<Link className="primary-btn" to="/organization/register">Register As An Organization</Link>}
          />
      </AuthenticatedShell>
    );
  }

  return (
    <FeedContent
      animals={animals}
      posts={posts}
      selectedAnimal={selectedAnimal}
      onSelectAnimal={setSelectedAnimal}
      action={(
        <Link className="primary-btn" to="/login">Login To Help</Link>
      )}
    />
  );
}

export default PostFeed;
