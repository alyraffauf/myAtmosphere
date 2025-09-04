import React from "react";
import Post from "./Post";
import { type BlueskyThreadItem } from "../utils/bluesky";

interface ThreadProps {
  thread: BlueskyThreadItem;
  handle: string;
}

const Thread: React.FC<ThreadProps> = ({ thread, handle }) => {
  const renderPost = (
    postItem: BlueskyThreadItem,
    isChild = false,
    depth = 0,
  ): JSX.Element => {
    return (
      <div
        key={postItem.post.uri}
        className={`thread-post ${isChild ? "thread-child" : "thread-root"}`}
      >
        <Post post={postItem.post} handle={handle} isInThread={true} />

        {postItem.children && postItem.children.length > 0 && (
          <div className="thread-children">
            {postItem.children.map((child) =>
              renderPost(child, true, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return <div className="thread-container">{renderPost(thread)}</div>;
};

export default Thread;
