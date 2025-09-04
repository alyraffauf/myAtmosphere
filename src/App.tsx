import { useState, useEffect, useCallback } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import Thread from "./components/Thread";
import LoadingSkeletons, {
  ProfileSkeleton,
} from "./components/LoadingSkeletons";
import Profile from "./components/Profile";
import {
  fetchUserPosts,
  fetchUserProfile,
  type BlueskyThreadItem,
  type ProfileData,
} from "./utils/bluesky";

const HANDLE = "aly.ruffruff.party";
const PROFILE_URL = `https://bsky.app/profile/${HANDLE}`;

function App(): JSX.Element {
  const [threads, setThreads] = useState<BlueskyThreadItem[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const loadPosts = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true);
          setError(null);
        }

        const response = await fetchUserPosts(
          HANDLE,
          isInitial ? null : cursor,
        );

        if (isInitial) {
          setThreads(response.posts);
        } else {
          setThreads((prevThreads) => [...prevThreads, ...response.posts]);
        }

        setCursor(response.cursor || null);
        setHasMore(!!response.cursor && response.posts.length > 0);
      } catch (err) {
        console.error("Error loading posts:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load posts: ${errorMessage}`);
        setHasMore(false);
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    },
    [cursor],
  );

  useEffect(() => {
    // Load both profile and posts
    const loadInitialData = async () => {
      try {
        setProfileLoading(true);
        const profileData = await fetchUserProfile(HANDLE);
        if (profileData) {
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };

    loadInitialData();
    loadPosts(true);
  }, []);

  const handleViewBluesky = (): void => {
    window.open(PROFILE_URL, "_blank", "noopener,noreferrer");
  };

  const fetchMorePosts = (): void => {
    if (cursor && hasMore) {
      loadPosts(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        {profileLoading ? (
          <ProfileSkeleton />
        ) : (
          profile && (
            <Profile profile={profile} onViewBluesky={handleViewBluesky} />
          )
        )}
        <LoadingSkeletons count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        {profileLoading ? (
          <ProfileSkeleton />
        ) : (
          profile && (
            <Profile profile={profile} onViewBluesky={handleViewBluesky} />
          )
        )}
        <div className="error">
          {error}
          <br />
          <button
            onClick={() => loadPosts(true)}
            style={{
              marginTop: "10px",
              background: "none",
              border: "1px solid #1d9bf0",
              color: "#1d9bf0",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {profileLoading ? (
        <ProfileSkeleton />
      ) : (
        profile && (
          <Profile profile={profile} onViewBluesky={handleViewBluesky} />
        )
      )}

      {threads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌸</div>
          <div className="empty-text">no thoughts yet...</div>
          <div className="empty-subtext">check back soon for new posts! ✨</div>
        </div>
      ) : (
        <InfiniteScroll
          dataLength={threads.length}
          next={fetchMorePosts}
          hasMore={hasMore}
          loader={<LoadingSkeletons count={2} />}
          endMessage={
            <div className="loading" style={{ marginTop: "20px" }}>
              <p>you've read all my thoughts! 💕✨</p>
            </div>
          }
          refreshFunction={() => loadPosts(true)}
          pullDownToRefresh={false}
        >
          <div className="posts-container">
            {threads.map((thread, index) => (
              <Thread
                key={`${thread.post.uri}-${index}`}
                thread={thread}
                handle={HANDLE}
              />
            ))}
          </div>
        </InfiniteScroll>
      )}
    </div>
  );
}

export default App;
