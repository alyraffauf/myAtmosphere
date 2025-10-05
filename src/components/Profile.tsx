import { type ProfileData, formatPostText } from "../utils/bluesky";

interface ProfileProps {
  profile: ProfileData;
  onViewBluesky: () => void;
}

const BlueskyLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 568 501"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C411.5 516.802 284 234.873 284 234.873C284 234.873 156.5 516.802 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0533 296.954 15.7778 224.501C9.94444 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1333 1.61183 123.121 33.6637Z" />
  </svg>
);

const Profile: React.FC<ProfileProps> = ({ profile, onViewBluesky }) => {
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="header-profile-container">
      <div className="header-top">
        <div className="header-left">
          <h1>aly's atmosphere ☁️💕</h1>
          <div className="profile-main-info">
            {profile.avatar && (
              <img
                src={profile.avatar}
                alt={`${profile.handle} avatar`}
                className="header-avatar"
              />
            )}
            <div className="header-info">
              <h2 className="header-display-name">
                {profile.displayName || profile.handle}
                {profile.pronouns && (
                  <span className="pronouns">({profile.pronouns})</span>
                )}
              </h2>
              <p className="header-handle">@{profile.handle}</p>
            </div>
          </div>
        </div>
        <button className="view-bluesky-btn" onClick={onViewBluesky}>
          <span className="desktop-text">
            visit me on bsky <BlueskyLogo className="bsky-logo" />
          </span>
          <span className="mobile-text">
            bsky <BlueskyLogo className="bsky-logo" />
          </span>
        </button>
      </div>

      {profile.description && (
        <div className="profile-bio">
          <p
            dangerouslySetInnerHTML={{
              __html: formatPostText(profile.description),
            }}
          />
        </div>
      )}

      <div className="profile-stats">
        <button
          className="stat-item"
          onClick={() =>
            window.open(
              `https://bsky.app/profile/${profile.handle}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          title="View posts on Bluesky"
        >
          <span className="stat-number">
            {formatCount(profile.postsCount || 0)}
          </span>
          <span className="stat-label">posts</span>
        </button>
        <button
          className="stat-item"
          onClick={() =>
            window.open(
              `https://bsky.app/profile/${profile.handle}/followers`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          title="View followers on Bluesky"
        >
          <span className="stat-number">
            {formatCount(profile.followersCount || 0)}
          </span>
          <span className="stat-label">followers</span>
        </button>
        <button
          className="stat-item"
          onClick={() =>
            window.open(
              `https://bsky.app/profile/${profile.handle}/follows`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          title="View following on Bluesky"
        >
          <span className="stat-number">
            {formatCount(profile.followsCount || 0)}
          </span>
          <span className="stat-label">following</span>
        </button>
      </div>
    </div>
  );
};

export default Profile;
