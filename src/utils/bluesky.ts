// Bluesky API utilities
import { cache } from "./cache";

const BLUESKY_API_BASE = "https://public.api.bsky.app/xrpc";

// Types for Bluesky API responses
interface BlueskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyRecord {
  text: string;
  createdAt: string;
  facets?: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{
      $type: string;
      uri?: string;
      did?: string;
    }>;
  }>;
  reply?: {
    parent: { uri: string };
    root: { uri: string };
  };
  $type?: string;
}

export interface BlueskyEmbed {
  $type: string;
  images?: Array<{ fullsize: string; thumb: string; alt?: string }>;
  record?: BlueskyEmbeddedRecord;
  media?: {
    $type: string;
    images?: Array<{ fullsize: string; thumb: string; alt?: string }>;
  };
}

export interface BlueskyEmbeddedRecord {
  $type: string;
  uri?: string;
  cid?: string;
  author?: BlueskyAuthor;
  value?: BlueskyRecord;
  indexedAt?: string;
  createdAt?: string;
  record?: BlueskyEmbeddedRecord;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: BlueskyAuthor;
  record: BlueskyRecord;
  embed?: BlueskyEmbed;
  indexedAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
}

export interface BlueskyFeedItem {
  post: BlueskyPost;
  reason?: {
    $type: string;
    by?: BlueskyAuthor;
    indexedAt?: string;
  };
}

export interface BlueskyThreadItem extends BlueskyFeedItem {
  children: BlueskyThreadItem[];
  isThreadRoot: boolean;
}

export interface PostsResponse {
  posts: BlueskyThreadItem[];
  cursor?: string | null;
}

export interface ProfileData {
  did: string;
  handle: string;
  displayName?: string;
  pronouns?: string;
  avatar?: string;
  banner?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  createdAt?: string;
  indexedAt?: string;
}

// Cache for storing profile data including avatars
/**
 * Fetch user profile information with caching
 */
export async function fetchUserProfile(
  handle: string,
): Promise<ProfileData | null> {
  // Check cache first
  const cached = cache.getProfile(handle);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `${BLUESKY_API_BASE}/app.bsky.actor.getProfile?actor=${handle}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch profile: ${response.status} ${response.statusText}`,
      );
    }

    const profile = await response.json();

    // Cache the profile
    cache.setProfile(handle, profile);

    return profile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Fetch posts from a Bluesky user's timeline
 */
export async function fetchUserPosts(
  handle: string,
  cursor: string | null = null,
  limit: number = 25,
  useCache: boolean = true,
): Promise<PostsResponse> {
  try {
    // Check cache first for initial load (when cursor is null)
    if (useCache && !cursor) {
      const cached = cache.getPosts(handle);
      if (cached) {
        return {
          posts: cached.posts,
          cursor: cached.cursor,
        };
      }
    }

    // First, resolve the handle to get the DID
    const resolveResponse = await fetch(
      `${BLUESKY_API_BASE}/com.atproto.identity.resolveHandle?handle=${handle}`,
    );

    if (!resolveResponse.ok) {
      throw new Error(
        `Failed to resolve handle: ${resolveResponse.status} ${resolveResponse.statusText}`,
      );
    }

    const { did } = await resolveResponse.json();

    // Build the timeline URL with parameters
    const params = new URLSearchParams({
      actor: did,
      limit: limit.toString(),
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const timelineResponse = await fetch(
      `${BLUESKY_API_BASE}/app.bsky.feed.getAuthorFeed?${params}`,
    );

    if (!timelineResponse.ok) {
      throw new Error(
        `Failed to fetch posts: ${timelineResponse.status} ${timelineResponse.statusText}`,
      );
    }

    const data = await timelineResponse.json();

    // Filter posts to only include original content and self-only reply threads
    // Keep: original posts, quote posts, embedded records, replies in threads with only me
    // Exclude: pure reposts, replies in threads with other people
    const filteredPosts = await filterPostsForSelfOnlyThreads(data.feed, did);

    // Group posts into threads
    const threadedPosts = await groupPostsIntoThreads(filteredPosts, did);

    // Enhance posts with avatar data
    const enhancedPosts = await enhancePostsWithAvatars(threadedPosts);

    // Cache the results
    if (useCache) {
      cache.setPosts(handle, enhancedPosts, data.cursor, !cursor);
    }

    return {
      posts: enhancedPosts,
      cursor: data.cursor,
    };
  } catch (error) {
    console.error("Error fetching user posts:", error);
    throw error;
  }
}

/**
 * Fetch profile information including avatar for a user
 */
async function fetchProfileData(did: string): Promise<ProfileData | null> {
  // Check cache first
  const cached = cache.getProfile(did);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `${BLUESKY_API_BASE}/app.bsky.actor.getProfile?actor=${did}`,
    );

    if (response.ok) {
      const profileData = await response.json();
      // Cache the profile data
      cache.setProfile(did, profileData);
      return profileData;
    }
  } catch (error) {
    console.warn("Failed to fetch profile data for", did, error);
  }

  return null;
}

/**
 * Enhance posts with avatar data from profiles
 */
async function enhancePostsWithAvatars(
  threads: BlueskyThreadItem[],
): Promise<BlueskyThreadItem[]> {
  const uniqueDids = new Set<string>();

  // Collect all unique DIDs from threads and their children recursively
  function collectDidsFromThread(threadItem: BlueskyThreadItem): void {
    const post = threadItem.post;
    uniqueDids.add(post.author.did);

    // Check for embedded records
    if (post.embed) {
      if (
        post.embed.$type === "app.bsky.embed.record#view" &&
        post.embed.record
      ) {
        if (post.embed.record.author) {
          uniqueDids.add(post.embed.record.author.did);
        }
      } else if (
        post.embed.$type === "app.bsky.embed.recordWithMedia#view" &&
        post.embed.record?.record
      ) {
        if (post.embed.record.record.author) {
          uniqueDids.add(post.embed.record.record.author.did);
        }
      }
    }

    // Process children recursively
    if (threadItem.children) {
      threadItem.children.forEach((child) => collectDidsFromThread(child));
    }
  }

  threads.forEach((thread) => collectDidsFromThread(thread));

  // Fetch profile data for all unique DIDs
  const profilePromises = Array.from(uniqueDids).map((did: string) =>
    fetchProfileData(did),
  );
  await Promise.all(profilePromises);

  // Enhance threads with avatar data recursively
  function enhanceThreadWithAvatars(
    threadItem: BlueskyThreadItem,
  ): BlueskyThreadItem {
    const post = threadItem.post;
    const authorProfile = cache.getProfile(post.author.did);

    if (authorProfile && authorProfile.avatar) {
      post.author.avatar = authorProfile.avatar;
    }

    // Enhance embedded records too
    if (post.embed) {
      if (
        post.embed.$type === "app.bsky.embed.record#view" &&
        post.embed.record
      ) {
        if (post.embed.record.author) {
          const embeddedAuthorProfile = cache.getProfile(
            post.embed.record.author.did,
          );
          if (embeddedAuthorProfile && embeddedAuthorProfile.avatar) {
            post.embed.record.author.avatar = embeddedAuthorProfile.avatar;
          }
        }
      } else if (
        post.embed.$type === "app.bsky.embed.recordWithMedia#view" &&
        post.embed.record?.record
      ) {
        if (post.embed.record.record.author) {
          const embeddedAuthorProfile = cache.getProfile(
            post.embed.record.record.author.did,
          );
          if (embeddedAuthorProfile && embeddedAuthorProfile.avatar) {
            post.embed.record.record.author.avatar =
              embeddedAuthorProfile.avatar;
          }
        }
      }
    }

    // Enhance children recursively
    if (threadItem.children) {
      threadItem.children.forEach((child) => enhanceThreadWithAvatars(child));
    }

    return threadItem;
  }

  return threads.map((thread) => enhanceThreadWithAvatars(thread));
}

/**
 * Format post text with clickable links
 */
export function formatPostText(
  text: string,
  facets: BlueskyRecord["facets"] = [],
): string {
  if (!facets || facets.length === 0) {
    let formattedText = text;

    // First handle full URLs with protocol
    const httpUrlRegex = /(https?:\/\/[^\s<>"]+)/g;
    formattedText = formattedText.replace(
      httpUrlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );

    // Handle emails (but not if already in a link)
    const emailRegex =
      /(?<!href=")([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    formattedText = formattedText.replace(
      emailRegex,
      '<a href="mailto:$1">$1</a>',
    );

    // Handle bare domains (avoiding already linked content)
    const bareUrlRegex =
      /(?<!href="|>)(?<!https?:\/\/)(\b[a-zA-Z0-9.-]+\.(?:codes|dev|io|me|co|app|com|net|org)(?:\/[^\s<>"]*)?)\b(?![^<]*<\/a>)/g;
    formattedText = formattedText.replace(
      bareUrlRegex,
      '<a href="https://$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );

    // Convert newlines to HTML line breaks
    formattedText = formattedText.replace(/\n/g, "<br>");

    return formattedText;
  }

  // Sort facets by start position in descending order to avoid offset issues
  const sortedFacets = [...facets].sort(
    (a, b) => b.index.byteStart - a.index.byteStart,
  );

  let formattedText = text;

  for (const facet of sortedFacets) {
    const { byteStart, byteEnd } = facet.index;
    const beforeText = formattedText.slice(0, byteStart);
    const facetText = formattedText.slice(byteStart, byteEnd);
    const afterText = formattedText.slice(byteEnd);

    for (const feature of facet.features) {
      if (feature.$type === "app.bsky.richtext.facet#link") {
        const link = `<a href="${feature.uri}" target="_blank" rel="noopener noreferrer">${facetText}</a>`;
        formattedText = beforeText + link + afterText;
        break;
      } else if (feature.$type === "app.bsky.richtext.facet#mention") {
        const mention = `<a href="https://bsky.app/profile/${feature.did}" target="_blank" rel="noopener noreferrer">${facetText}</a>`;
        formattedText = beforeText + mention + afterText;
        break;
      }
    }
  }

  // Convert newlines to HTML line breaks
  formattedText = formattedText.replace(/\n/g, "<br>");

  return formattedText;
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Get the URL for a post on bsky.app
 */
export function getPostUrl(uri: string, handle: string): string {
  // Extract the post ID from the URI
  // URI format: at://did:plc:xxx/app.bsky.feed.post/postid
  const postId = uri.split("/").pop();
  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

/**
 * Extract image URLs from post embed data
 */
export function extractImages(embed?: BlueskyEmbed): string[] {
  if (!embed) return [];

  // Handle regular image embeds
  if (embed.$type === "app.bsky.embed.images#view" && embed.images) {
    return embed.images.map((img) => img.fullsize);
  }

  // Handle images in recordWithMedia embeds (quote posts with images)
  if (embed.$type === "app.bsky.embed.recordWithMedia#view" && embed.media) {
    if (
      embed.media.$type === "app.bsky.embed.images#view" &&
      embed.media.images
    ) {
      return embed.media.images.map((img) => img.fullsize);
    }
  }

  return [];
}

/**
 * Filter posts to only include self-only threads
 */
async function filterPostsForSelfOnlyThreads(
  feedItems: BlueskyFeedItem[],
  userDid: string,
): Promise<BlueskyFeedItem[]> {
  const filteredPosts = [];

  for (const item of feedItems) {
    const post = item.post;

    // Exclude pure reposts - these are reshares without additional content
    if (
      item.reason &&
      item.reason.$type === "app.bsky.feed.defs#reasonRepost"
    ) {
      continue;
    }

    // Exclude repost records (pure reshares)
    if (post.record.$type === "app.bsky.feed.repost") {
      continue;
    }

    // Include all posts with text content
    if (post.record.text !== undefined) {
      // If it's not a reply, include it (original posts and quote posts)
      if (!post.record.reply) {
        filteredPosts.push(item);
        continue;
      }

      // If it's a reply, check if the entire thread contains only the user
      const isValidReply = await isReplyInSelfOnlyThread(post, userDid);
      if (isValidReply) {
        filteredPosts.push(item);
      }
    }
  }

  return filteredPosts;
}

/**
 * Check if a reply is part of a chain that only contains the user
 */
async function isReplyInSelfOnlyThread(
  post: BlueskyPost,
  userDid: string,
): Promise<boolean> {
  try {
    // Walk up the reply chain to check all parents
    let currentPost = post;
    const checkedAuthors = new Set();

    while (currentPost) {
      // Add current post author to checked authors
      checkedAuthors.add(currentPost.author.did);

      // If we find someone other than the user, this is not a self-only thread
      if (currentPost.author.did !== userDid) {
        return false;
      }

      // If there's no reply reference, we've reached the root
      if (!currentPost.record.reply) {
        break;
      }

      // Get the parent post
      const parentUri = currentPost.record.reply.parent.uri;
      const parentResponse = await fetch(
        `${BLUESKY_API_BASE}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(parentUri)}&depth=0`,
      );

      if (!parentResponse.ok) {
        // If we can't get parent info, be conservative and exclude
        return false;
      }

      const parentData = await parentResponse.json();
      currentPost = parentData.thread.post;
    }

    // Only allow if all authors in the reply chain are the user
    return checkedAuthors.size === 1 && checkedAuthors.has(userDid);
  } catch (error) {
    console.warn("Failed to check reply chain for post", post.uri, error);
    // If we can't verify, be conservative and exclude the reply
    return false;
  }
}

/**
 * Group posts into threads by connecting replies to their parents
 */
async function groupPostsIntoThreads(
  posts: BlueskyFeedItem[],
  _userDid: string,
): Promise<BlueskyThreadItem[]> {
  const postMap = new Map<string, BlueskyThreadItem>();
  const threadRoots: BlueskyThreadItem[] = [];

  // First pass: index all posts by URI
  posts.forEach((item) => {
    postMap.set(item.post.uri, {
      ...item,
      children: [],
      isThreadRoot: false,
    });
  });

  // Second pass: build thread structure
  posts.forEach((item) => {
    const post = item.post;
    const postData = postMap.get(post.uri);

    if (!postData) return;

    if (post.record.reply) {
      // This is a reply, find its parent
      const parentUri = post.record.reply.parent.uri;
      const parent = postMap.get(parentUri);

      if (parent) {
        // Parent exists in our filtered posts, add as child
        parent.children.push(postData);
      } else {
        // Parent not in our posts (might be filtered out), treat as root
        postData.isThreadRoot = true;
        threadRoots.push(postData);
      }
    } else {
      // This is a top-level post, it's a thread root
      postData.isThreadRoot = true;
      threadRoots.push(postData);
    }
  });

  // Sort thread roots by date (newest first)
  threadRoots.sort(
    (a, b) =>
      new Date(b.post.indexedAt).getTime() -
      new Date(a.post.indexedAt).getTime(),
  );

  // Sort children within each thread by date (oldest first for chronological reading)
  function sortThreadChildren(thread: BlueskyThreadItem): void {
    thread.children.sort(
      (a, b) =>
        new Date(a.post.indexedAt).getTime() -
        new Date(b.post.indexedAt).getTime(),
    );
    thread.children.forEach((child) => sortThreadChildren(child));
  }

  threadRoots.forEach((root) => sortThreadChildren(root));

  return threadRoots;
}

/**
 * Get engagement stats from a post
 */
export function getEngagementStats(post: BlueskyPost): {
  likes: number;
  reposts: number;
  replies: number;
} {
  return {
    likes: post.likeCount || 0,
    reposts: post.repostCount || 0,
    replies: post.replyCount || 0,
  };
}
