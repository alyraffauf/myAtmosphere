import React from "react";

interface LoadingSkeletonsProps {
  count?: number;
}

const PostSkeleton: React.FC = () => (
  <div className="skeleton-post">
    <div className="skeleton-header">
      <div className="skeleton skeleton-avatar"></div>
      <div className="skeleton-author-info">
        <div className="skeleton skeleton-name"></div>
        <div
          className="skeleton skeleton-handle"
          style={{ marginTop: "4px" }}
        ></div>
      </div>
      <div
        className="skeleton skeleton-time"
        style={{ marginLeft: "auto", width: "40px", height: "14px" }}
      ></div>
    </div>
    <div className="skeleton skeleton-content"></div>
    <div className="skeleton skeleton-content"></div>
    <div className="skeleton skeleton-content"></div>
  </div>
);

const ProfileSkeleton: React.FC = () => (
  <div className="skeleton-post header-profile-container">
    <div className="header-top">
      <div className="header-left">
        <div
          className="skeleton"
          style={{ width: "280px", height: "28px", marginBottom: "15px" }}
        ></div>
        <div className="profile-main-info">
          <div className="skeleton skeleton-avatar header-avatar"></div>
          <div className="header-info">
            <div
              className="skeleton"
              style={{ width: "140px", height: "20px", marginBottom: "4px" }}
            ></div>
            <div
              className="skeleton"
              style={{ width: "100px", height: "14px" }}
            ></div>
          </div>
        </div>
      </div>
      <div
        className="skeleton"
        style={{ width: "120px", height: "40px", borderRadius: "25px" }}
      ></div>
    </div>
    <div
      className="skeleton"
      style={{ height: "60px", marginBottom: "20px", borderRadius: "15px" }}
    ></div>
    <div className="profile-stats">
      <div className="stat-item">
        <div
          className="skeleton"
          style={{ width: "30px", height: "20px", marginBottom: "4px" }}
        ></div>
        <div
          className="skeleton"
          style={{ width: "40px", height: "12px" }}
        ></div>
      </div>
      <div className="stat-item">
        <div
          className="skeleton"
          style={{ width: "30px", height: "20px", marginBottom: "4px" }}
        ></div>
        <div
          className="skeleton"
          style={{ width: "50px", height: "12px" }}
        ></div>
      </div>
      <div className="stat-item">
        <div
          className="skeleton"
          style={{ width: "30px", height: "20px", marginBottom: "4px" }}
        ></div>
        <div
          className="skeleton"
          style={{ width: "55px", height: "12px" }}
        ></div>
      </div>
    </div>
  </div>
);

const LoadingSkeletons: React.FC<LoadingSkeletonsProps> = ({ count = 3 }) => {
  return (
    <div className="loading-skeletons">
      {Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
    </div>
  );
};

export { ProfileSkeleton };
export default LoadingSkeletons;
