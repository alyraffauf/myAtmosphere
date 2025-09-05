// Cache utility for posts and profiles with localStorage persistence

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export interface PostsCacheData {
  posts: any[];
  cursor: string | null;
  handle: string;
}

class Cache {
  private readonly CACHE_PREFIX = "bskyweb_cache_";
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly POSTS_TTL = 2 * 60 * 1000; // 2 minutes for posts (fresher content)
  private readonly PROFILE_TTL = 30 * 60 * 1000; // 30 minutes for profiles

  private getKey(key: string): string {
    return `${this.CACHE_PREFIX}${key}`;
  }

  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() > item.timestamp + item.expiry;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: ttl || this.DEFAULT_TTL,
    };

    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(item));
    } catch (error) {
      console.warn("Failed to save to localStorage:", error);
      // If localStorage is full or unavailable, continue without caching
    }
  }

  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(this.getKey(key));
      if (!cached) {
        return null;
      }

      const item: CacheItem<T> = JSON.parse(cached);

      if (this.isExpired(item)) {
        this.delete(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn("Failed to read from localStorage:", error);
      return null;
    }
  }

  delete(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.warn("Failed to delete from localStorage:", error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  }

  // Posts-specific methods
  setPosts(
    handle: string,
    posts: any[],
    cursor: string | null,
    isInitial = false,
  ): void {
    const key = `posts_${handle}`;

    if (isInitial) {
      // For initial load, replace the entire cache
      const cacheData: PostsCacheData = {
        posts,
        cursor,
        handle,
      };
      this.set(key, cacheData, this.POSTS_TTL);
    } else {
      // For pagination, append to existing cache
      const existing = this.getPosts(handle);
      if (existing) {
        const cacheData: PostsCacheData = {
          posts: [...existing.posts, ...posts],
          cursor,
          handle,
        };
        this.set(key, cacheData, this.POSTS_TTL);
      } else {
        // Fallback to setting as new cache
        const cacheData: PostsCacheData = {
          posts,
          cursor,
          handle,
        };
        this.set(key, cacheData, this.POSTS_TTL);
      }
    }
  }

  getPosts(handle: string): PostsCacheData | null {
    return this.get<PostsCacheData>(`posts_${handle}`);
  }

  appendPosts(handle: string, newPosts: any[], newCursor: string | null): void {
    const existing = this.getPosts(handle);
    if (existing) {
      // Check for duplicates using post URI
      const existingUris = new Set(
        existing.posts.map((thread) => thread.post?.uri),
      );
      const uniqueNewPosts = newPosts.filter(
        (thread) => !existingUris.has(thread.post?.uri),
      );

      if (uniqueNewPosts.length > 0) {
        const cacheData: PostsCacheData = {
          posts: [...existing.posts, ...uniqueNewPosts],
          cursor: newCursor,
          handle,
        };
        this.set(`posts_${handle}`, cacheData, this.POSTS_TTL);
      }
    }
  }

  // Profile-specific methods
  setProfile(handle: string, profile: any): void {
    this.set(`profile_${handle}`, profile, this.PROFILE_TTL);
  }

  getProfile(handle: string): any | null {
    return this.get(`profile_${handle}`);
  }

  // Get cache freshness for UI feedback
  getCacheFreshness(handle: string): { isFresh: boolean; age: number } | null {
    try {
      const cached = localStorage.getItem(this.getKey(`posts_${handle}`));
      if (!cached) return null;

      const item: CacheItem<PostsCacheData> = JSON.parse(cached);
      const age = Date.now() - item.timestamp;
      const isFresh = age < this.POSTS_TTL;

      return { isFresh, age };
    } catch (error) {
      return null;
    }
  }

  // Preload next batch of posts in background
  async preloadNextBatch(
    handle: string,
    fetchFunction: (handle: string, cursor: string | null) => Promise<any>,
  ): Promise<void> {
    const cached = this.getPosts(handle);
    if (!cached || !cached.cursor) return;

    try {
      // Fetch next batch silently
      const response = await fetchFunction(handle, cached.cursor);
      if (response.posts && response.posts.length > 0) {
        this.appendPosts(handle, response.posts, response.cursor);
      }
    } catch (error) {
      // Silent failure for preloading - don't disrupt user experience
      console.debug("Preload failed:", error);
    }
  }
}

// Export singleton instance
export const cache = new Cache();
