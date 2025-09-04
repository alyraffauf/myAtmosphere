import React from "react";
import {
  formatDate,
  formatPostText,
  getPostUrl,
  extractImages,
  getEngagementStats,
  type BlueskyPost,
  type BlueskyEmbeddedRecord,
} from "../utils/bluesky";

interface PostProps {
  post: BlueskyPost;
  handle: string;
  isInThread?: boolean;
}

const Post: React.FC<PostProps> = ({ post, handle, isInThread = false }) => {
  const { record, author, uri, indexedAt, embed } = post;
  const stats = getEngagementStats(post);
  const images = extractImages(embed);
  const isReply = !!record.reply;

  // Check if this is a quote post with embedded record
  const hasEmbeddedRecord =
    embed &&
    (embed.$type === "app.bsky.embed.record#view" ||
      embed.$type === "app.bsky.embed.recordWithMedia#view");

  const handlePostClick = () => {
    const postUrl = getPostUrl(uri, handle);
    window.open(postUrl, "_blank", "noopener,noreferrer");
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent post click when clicking on image
  };

  const handleEmbedClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent post click when clicking on embedded post
  };

  const renderEmbeddedRecord = (): JSX.Element | null => {
    if (!hasEmbeddedRecord) return null;

    let embeddedRecord: BlueskyEmbeddedRecord | null = null;
    let embeddedImages: string[] = [];

    if (embed.$type === "app.bsky.embed.record#view" && embed.record) {
      embeddedRecord = embed.record as BlueskyEmbeddedRecord;
    } else if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
      embeddedRecord = embed.record?.record || null;
      // if (embed.media && embed.media.images) {
      //   embeddedImages = embed.media.images.map((img) => img.fullsize);
      // }
    }

    if (
      !embeddedRecord ||
      embeddedRecord.$type !== "app.bsky.embed.record#viewRecord"
    ) {
      return null;
    }

    return (
      <div className="embedded-post" onClick={handleEmbedClick}>
        <div className="embedded-post-header">
          {embeddedRecord.author?.avatar && (
            <img
              src={embeddedRecord.author.avatar}
              alt={`${embeddedRecord.author.handle} avatar`}
              className="embedded-post-avatar"
            />
          )}
          <div className="embedded-post-author-info">
            <span className="embedded-post-author">
              {embeddedRecord.author?.displayName ||
                embeddedRecord.author?.handle}
            </span>
            <span className="embedded-post-handle">
              @{embeddedRecord.author?.handle}
            </span>
          </div>
          <span className="embedded-post-time">
            {formatDate(
              embeddedRecord.indexedAt || embeddedRecord.createdAt || "",
            )}
          </span>
        </div>
        <div
          className="embedded-post-content"
          dangerouslySetInnerHTML={{
            __html: formatPostText(
              embeddedRecord.value?.text || "",
              embeddedRecord.value?.facets,
            ),
          }}
        />
        {embeddedImages.length > 0 && (
          <div className="embedded-post-images">
            {embeddedImages.map((imageUrl, index) => (
              <img
                key={index}
                src={imageUrl}
                alt={`Embedded image ${index + 1}`}
                className="embedded-post-image"
                loading="lazy"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`post ${isInThread ? "post-in-thread" : ""} ${isReply && !isInThread ? "thread-indicator" : ""}`}
      onClick={handlePostClick}
    >
      <div className="post-header">
        {author.avatar && (
          <img
            src={author.avatar}
            alt={`${author.handle} avatar`}
            className="post-avatar"
          />
        )}
        <div className="post-author-info">
          <span className="post-author">
            {author.displayName || author.handle}
          </span>
          <span className="post-handle">@{author.handle}</span>
        </div>
        <span className="post-time">{formatDate(indexedAt)}</span>
      </div>

      <div
        className="post-content"
        dangerouslySetInnerHTML={{
          __html: formatPostText(record.text, record.facets),
        }}
      />

      {images.length > 0 && (
        <div className="post-images" onClick={handleImageClick}>
          {images.map((imageUrl, index) => (
            <img
              key={index}
              src={imageUrl}
              alt={`Post image ${index + 1}`}
              className="post-image"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {renderEmbeddedRecord()}

      <div className="post-stats">
        {stats.replies > 0 && (
          <button
            className="stat cute-stat replies-stat"
            onClick={() =>
              window.open(
                getPostUrl(post.uri, post.author.handle),
                "_blank",
                "noopener,noreferrer",
              )
            }
            title={`${stats.replies} ${stats.replies === 1 ? "reply" : "replies"} - view on Bluesky`}
          >
            <span className="stat-emoji">💬</span>
            <span className="stat-count">{stats.replies}</span>
          </button>
        )}
        {stats.reposts > 0 && (
          <button
            className="stat cute-stat reposts-stat"
            onClick={() =>
              window.open(
                getPostUrl(post.uri, post.author.handle),
                "_blank",
                "noopener,noreferrer",
              )
            }
            title={`${stats.reposts} ${stats.reposts === 1 ? "repost" : "reposts"} - view on Bluesky`}
          >
            <span className="stat-emoji">🔄</span>
            <span className="stat-count">{stats.reposts}</span>
          </button>
        )}
        {stats.likes > 0 && (
          <button
            className="stat cute-stat likes-stat"
            onClick={() =>
              window.open(
                getPostUrl(post.uri, post.author.handle),
                "_blank",
                "noopener,noreferrer",
              )
            }
            title={`${stats.likes} ${stats.likes === 1 ? "like" : "likes"} - view on Bluesky`}
          >
            <span className="stat-emoji">💕</span>
            <span className="stat-count">{stats.likes}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Post;
