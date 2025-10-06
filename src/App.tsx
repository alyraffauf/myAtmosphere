import { useState, useEffect, useCallback, useRef } from "react";
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
import { cache } from "./utils/cache";

const HANDLE = "old.ruffruff.party";
const PROFILE_URL = `https://bsky.app/profile/${HANDLE}`;

function App(): JSX.Element {
  const [threads, setThreads] = useState<BlueskyThreadItem[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPaginating, setIsPaginating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const preloadTriggered = useRef<boolean>(false);
  const loadPosts = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) {
          setError(null);

          // Check cache first for instant loading
          const cached = cache.getPosts(HANDLE);
          if (cached) {
            setThreads(cached.posts);
            setCursor(cached.cursor);
            setHasMore(!!cached.cursor && cached.posts.length > 0);
            setLoading(false);

            // Start background refresh if cache is getting stale
            const freshness = cache.getCacheFreshness(HANDLE);
            if (freshness && freshness.age > 60000) {
              // 1 minute
              const response = await fetchUserPosts(HANDLE, null, 25, false);
              setThreads(response.posts);
              setCursor(response.cursor || null);
              setHasMore(!!response.cursor && response.posts.length > 0);
            }
            return;
          }

          setLoading(true);
        }

        if (!isInitial) {
          setIsPaginating(true);
        }

        const response = await fetchUserPosts(
          HANDLE,
          isInitial ? null : cursor,
          25,
          true,
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
        } else {
          setIsPaginating(false);
        }
      }
    },
    [cursor],
  );

  useEffect(() => {
    // Load both profile and posts
    const loadInitialData = async () => {
      try {
        // Check for cached profile first
        const cachedProfile = cache.getProfile(HANDLE);
        if (cachedProfile) {
          setProfile(cachedProfile);
          setProfileLoading(false);
        } else {
          setProfileLoading(true);
        }

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
  }, [loadPosts]);

  const handleViewBluesky = (): void => {
    window.open(PROFILE_URL, "_blank", "noopener,noreferrer");
  };

  const fetchMorePosts = useCallback((): void => {
    if (cursor && hasMore) {
      loadPosts(false);
    }
  }, [cursor, hasMore, loadPosts]);

  // Preload next batch when user is near the end
  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY + window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const threshold = 0.8; // Preload when 80% scrolled

    if (
      scrollPosition >= documentHeight * threshold &&
      cursor &&
      hasMore &&
      !preloadTriggered.current &&
      !loading
    ) {
      preloadTriggered.current = true;

      // Preload silently in background
      cache.preloadNextBatch(HANDLE, fetchUserPosts).then(() => {
        // Reset trigger after a delay to allow for more preloading
        setTimeout(() => {
          preloadTriggered.current = false;
        }, 2000);
      });
    }
  }, [cursor, hasMore, loading]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
        <div className="loading-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
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
          pullDownToRefresh={true}
          pullDownToRefreshThreshold={50}
          pullDownToRefreshContent={
            <h3 style={{ textAlign: "center" }}>
              &#8595; Pull down to refresh
            </h3>
          }
          releaseToRefreshContent={
            <h3 style={{ textAlign: "center" }}>&#8593; Release to refresh</h3>
          }
        >
          <div className="posts-container">
            {threads.map((thread, index) => (
              <Thread
                key={`${thread.post.uri}-${index}`}
                thread={thread}
                handle={HANDLE}
              />
            ))}

            {/* Bottom loading indicator */}
            {isPaginating && (
              <div className="loading-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            )}
          </div>
        </InfiniteScroll>
      )}
    </div>
  );
}

export default App;
