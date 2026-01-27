/**
 * Twitter API Client via RapidAPI
 * Pure API client - no database interactions, no verification logic
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TwitterUser {
  restId: string;
  screenName: string;
  name: string;
  profileImageUrl: string | null;
  description: string | null;
  location: string | null;
  websiteUrl: string | null;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  likesCount: number;
  listedCount: number;
  isVerified: boolean;
  isBlueVerified: boolean;
  professionalType: string | null;
  professionalCategory: string | null;
  accountCreatedAt: Date | null;
  raw: unknown;
}

export interface Tweet {
  tweetId: string;
  restId: string;
  conversationId: string | null;
  text: string;
  fullText: string;
  lang: string;
  authorId: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string | null;
  authorVerified: boolean;
  authorFollowers: number;
  retweetCount: number;
  likeCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  viewCount: number | null;
  isRetweet: boolean;
  isQuote: boolean;
  isReply: boolean;
  parentId: string | null;
  mediaUrls: string[];
  linkUrls: string[];
  hashtags: string[];
  mentions: string[];
  createdAt: Date | null;
  raw: unknown;
}

export interface SearchParams {
  query: string;
  type?: "Top" | "Latest" | "People";
  count?: number;
  cursor?: string;
}

export interface SearchResult {
  users: TwitterUser[];
  tweets: Tweet[];
  cursor: { top?: string; bottom?: string } | null;
  metadata: {
    requestedCount: number;
    actualCount: number;
    responseTime: number;
    pages: number;
  };
}

// ============================================================================
// CLIENT
// ============================================================================

export class TwitterService {
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.RAPID_API_KEY || "";
    this.apiHost = "twitter241.p.rapidapi.com";
    this.baseUrl = `https://${this.apiHost}`;

    if (!this.apiKey) {
      console.warn("[TwitterService] RAPID_API_KEY is not set - API calls will fail");
    }
  }

  private getHeaders(): HeadersInit {
    return {
      "X-Rapidapi-Key": this.apiKey,
      "X-Rapidapi-Host": this.apiHost,
      Accept: "application/json",
    };
  }

  // --------------------------------------------------------------------------
  // User Endpoints
  // --------------------------------------------------------------------------

  /**
   * Fetch user by screen name (handle)
   */
  async getUserByHandle(handle: string): Promise<TwitterUser | null> {
    const cleanHandle = handle.replace(/^@+/, "").trim();
    if (!cleanHandle) return null;

    try {
      const url = new URL("/user-by-screen-name", this.baseUrl);
      url.searchParams.set("screen_name", cleanHandle);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`[TwitterService] Failed to fetch user by handle: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseUserResponse(data);
    } catch (error) {
      console.error("[TwitterService] Error fetching user by handle:", error);
      return null;
    }
  }

  /**
   * Fetch user by Twitter ID
   */
  async getUserById(userId: string): Promise<TwitterUser | null> {
    const cleanId = (userId || "").trim();
    if (!cleanId) return null;

    try {
      const url = new URL("/user-by-id", this.baseUrl);
      url.searchParams.set("user_id", cleanId);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`[TwitterService] Failed to fetch user by ID: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return this.parseUserResponse(data);
    } catch (error) {
      console.error("[TwitterService] Error fetching user by ID:", error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Tweet Endpoints
  // --------------------------------------------------------------------------

  /**
   * Fetch a specific tweet by ID
   */
  async getTweetById(tweetId: string): Promise<Tweet | null> {
    try {
      const url = new URL("/tweet", this.baseUrl);
      url.searchParams.set("pid", tweetId);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`[TwitterService] Failed to fetch tweet: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Try threaded conversation format first
      const threaded = data?.data?.threaded_conversation_with_injections_v2;
      if (threaded) {
        const tweets = this.extractTweetsFromThreadedConversation(data);
        // Return the first tweet (main tweet) or the one matching the requested ID
        if (tweets.length > 0) {
          return tweets.find(t => t.tweetId === tweetId) || tweets[0];
        }
      }
      
      // Fallback to other formats
      const result = data?.result || data?.data?.tweetResult?.result;
      if (!result) return null;

      return this.parseTweet(result, "");
    } catch (error) {
      console.error("[TwitterService] Error fetching tweet by ID:", error);
      return null;
    }
  }

  /**
   * Fetch recent tweets from a user's timeline
   */
  async getUserTweets(userId: string, count: number = 20): Promise<Tweet[]> {
    try {
      const url = new URL("/user-tweets", this.baseUrl);
      url.searchParams.set("user", userId);
      url.searchParams.set("count", String(Math.max(1, Math.min(50, count))));

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`[TwitterService] Failed to fetch user tweets: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return this.extractTweetsFromTimeline(data);
    } catch (error) {
      console.error("[TwitterService] Error fetching user tweets:", error);
      return [];
    }
  }

  /**
   * Fetch user's replies
   */
  async getUserReplies(userId: string, count: number = 20): Promise<Tweet[]> {
    try {
      const url = new URL("/user-replies", this.baseUrl);
      url.searchParams.set("user", userId);
      url.searchParams.set("count", String(Math.max(1, Math.min(50, count))));

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(`[TwitterService] Failed to fetch user replies: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return this.extractTweetsFromTimeline(data);
    } catch (error) {
      console.error("[TwitterService] Error fetching user replies:", error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Search Endpoints
  // --------------------------------------------------------------------------

  /**
   * Search for users and tweets with pagination
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();
    const allUsers: TwitterUser[] = [];
    const allTweets: Tweet[] = [];
    let pages = 0;
    let currentCursor = params.cursor;
    let lastCursor: { top?: string; bottom?: string } | null = null;

    try {
      const pageSize = 20;
      const maxPages = Math.ceil((params.count || 100) / pageSize);

      while (pages < maxPages) {
        const searchUrl = new URL("/search-v2", this.baseUrl);
        searchUrl.searchParams.set("type", params.type || "Top");
        searchUrl.searchParams.set("count", pageSize.toString());
        searchUrl.searchParams.set("query", params.query);

        if (currentCursor) {
          searchUrl.searchParams.set("cursor", currentCursor);
        }

        const response = await fetch(searchUrl.toString(), {
          method: "GET",
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Twitter API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        pages++;

        const pageUsers = this.extractUsersFromSearch(data);
        const pageTweets = this.extractTweetsFromSearch(data, params.query);

        allUsers.push(...pageUsers);
        allTweets.push(...pageTweets);

        const nextCursor = this.extractCursor(data);
        lastCursor = nextCursor;

        if (!nextCursor?.bottom || (pageUsers.length === 0 && pageTweets.length === 0)) {
          break;
        }

        currentCursor = nextCursor.bottom;

        // Rate limit delay
        if (pages < maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      return {
        users: allUsers,
        tweets: allTweets,
        cursor: lastCursor,
        metadata: {
          requestedCount: params.count || 100,
          actualCount: allUsers.length + allTweets.length,
          responseTime: Date.now() - startTime,
          pages,
        },
      };
    } catch (error) {
      console.error("[TwitterService] Search failed:", error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Extract tweet ID from a tweet URL
   */
  extractTweetIdFromUrl(url: string): string | null {
    const patterns = [
      /twitter\.com\/\w+\/status\/(\d+)/,
      /x\.com\/\w+\/status\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Response Parsing (Private)
  // --------------------------------------------------------------------------

  private parseUserResponse(data: unknown): TwitterUser | null {
    try {
      const d = data as Record<string, unknown>;
      const result = d?.result || d?.data || d;
      const r = result as Record<string, unknown>;
      const userObj = r?.user as Record<string, unknown> | undefined;
      const legacy = (r?.legacy || userObj?.legacy || userObj) as Record<string, unknown>;

      const restId = r?.rest_id || (r?.user as Record<string, unknown>)?.rest_id || r?.id_str;
      if (!restId) return null;

      const core = r?.core as Record<string, unknown>;
      const verification = r?.verification as Record<string, unknown>;
      const professional = r?.professional as Record<string, unknown>;
      const location = r?.location as Record<string, unknown>;
      const avatar = r?.avatar as Record<string, unknown>;

      const createdAt = core?.created_at || legacy?.created_at;

      return {
        restId: String(restId),
        screenName: String(core?.screen_name || legacy?.screen_name || ""),
        name: String(core?.name || legacy?.name || ""),
        profileImageUrl: (avatar?.image_url || legacy?.profile_image_url_https || null) as string | null,
        description: (legacy?.description || null) as string | null,
        location: (location?.location || legacy?.location || null) as string | null,
        websiteUrl: (legacy?.url || null) as string | null,
        followersCount: Number(legacy?.followers_count || 0),
        followingCount: Number(legacy?.friends_count || 0),
        tweetsCount: Number(legacy?.statuses_count || 0),
        likesCount: Number(legacy?.favourites_count || 0),
        listedCount: Number(legacy?.listed_count || 0),
        isVerified: !!(verification?.verified || legacy?.verified),
        isBlueVerified: !!(r?.is_blue_verified || legacy?.is_blue_verified),
        professionalType: (professional?.professional_type || null) as string | null,
        professionalCategory: ((professional?.category as Array<{ name: string }>)?.[0]?.name || null) as string | null,
        accountCreatedAt: createdAt ? new Date(createdAt as string) : null,
        raw: data,
      };
    } catch (error) {
      console.error("[TwitterService] Error parsing user response:", error);
      return null;
    }
  }

  private parseTweet(tweet: Record<string, unknown>, keyword: string): Tweet | null {
    try {
      const legacy = tweet.legacy as Record<string, unknown>;
      const core = tweet.core as Record<string, unknown>;
      const userResults = core?.user_results as Record<string, unknown>;
      const author = userResults?.result as Record<string, unknown>;
      const authorLegacy = author?.legacy as Record<string, unknown>;
      const views = tweet.views as Record<string, unknown>;
      const entities = legacy?.entities as Record<string, unknown>;

      const createdAt = legacy?.created_at;

      return {
        tweetId: String(legacy?.id_str || tweet.rest_id || ""),
        restId: String(tweet.rest_id || ""),
        conversationId: (legacy?.conversation_id_str || null) as string | null,
        text: String(legacy?.full_text || legacy?.text || ""),
        fullText: String(legacy?.full_text || legacy?.text || ""),
        lang: String(legacy?.lang || "en"),
        authorId: String(author?.rest_id || ""),
        authorHandle: String(authorLegacy?.screen_name || ""),
        authorName: String((author?.core as Record<string, unknown>)?.name || authorLegacy?.name || ""),
        authorAvatar: (authorLegacy?.profile_image_url_https || null) as string | null,
        authorVerified: !!((author?.verification as Record<string, unknown>)?.verified || authorLegacy?.verified),
        authorFollowers: Number(authorLegacy?.followers_count || 0),
        retweetCount: Number(legacy?.retweet_count || 0),
        likeCount: Number(legacy?.favorite_count || 0),
        replyCount: Number(legacy?.reply_count || 0),
        quoteCount: Number(legacy?.quote_count || 0),
        bookmarkCount: Number(legacy?.bookmark_count || 0),
        viewCount: views?.count ? Number(views.count) : null,
        isRetweet: !!legacy?.retweeted_status_id_str,
        isQuote: !!legacy?.quoted_status_id_str,
        isReply: !!legacy?.in_reply_to_status_id_str,
        parentId: (legacy?.in_reply_to_status_id_str || null) as string | null,
        mediaUrls: ((entities?.media as Array<{ media_url_https: string }>)?.map((m) => m.media_url_https) || []),
        linkUrls: ((entities?.urls as Array<{ expanded_url: string }>)?.map((u) => u.expanded_url) || []),
        hashtags: ((entities?.hashtags as Array<{ text: string }>)?.map((h) => h.text) || []),
        mentions: ((entities?.user_mentions as Array<{ screen_name: string }>)?.map((m) => m.screen_name) || []),
        createdAt: createdAt ? new Date(createdAt as string) : null,
        raw: tweet,
      };
    } catch (error) {
      console.error("[TwitterService] Error parsing tweet:", error);
      return null;
    }
  }

  private extractTweetsFromTimeline(data: unknown): Tweet[] {
    const tweets: Tweet[] = [];

    try {
      // Try threaded conversation format first
      const d = data as Record<string, unknown>;
      const dataField = d?.data as Record<string, unknown> | undefined;
      const threaded = dataField?.threaded_conversation_with_injections_v2;
      if (threaded) {
        return this.extractTweetsFromThreadedConversation(data);
      }

      const result = d?.result as Record<string, unknown>;
      const timeline = result?.timeline as Record<string, unknown>;
      const instructions = (timeline?.instructions || []) as Array<Record<string, unknown>>;

      for (const instruction of instructions) {
        const entries = instruction.entries as Array<Record<string, unknown>>;
        if (!entries) continue;

        for (const entry of entries) {
          const content = entry.content as Record<string, unknown>;
          
          // Handle TimelineTimelineItem (direct tweet)
          if (content?.entryType === "TimelineTimelineItem") {
            const itemContent = content.itemContent as Record<string, unknown>;
            const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
            const tweet = tweetResults?.result as Record<string, unknown>;

            if (tweet && tweet.__typename === "Tweet") {
              const parsed = this.parseTweet(tweet, "");
              if (parsed) tweets.push(parsed);
            }
          }
          
          // Handle TimelineTimelineModule (conversation thread)
          if (content?.entryType === "TimelineTimelineModule" && content.items) {
            const items = content.items as Array<Record<string, unknown>>;
            for (const item of items) {
              const itemData = item.item as Record<string, unknown>;
              const itemContent = itemData?.itemContent as Record<string, unknown>;
              const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
              const tweet = tweetResults?.result as Record<string, unknown>;

              if (tweet && tweet.__typename === "Tweet") {
                const parsed = this.parseTweet(tweet, "");
                if (parsed) tweets.push(parsed);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[TwitterService] Error extracting tweets from timeline:", error);
    }

    return tweets;
  }

  private extractUsersFromSearch(data: unknown): TwitterUser[] {
    const users: TwitterUser[] = [];

    try {
      const instructions = this.getInstructions(data);

      for (const instruction of instructions) {
        if (instruction.type !== "TimelineAddEntries") continue;

        const entries = instruction.entries as Array<Record<string, unknown>>;
        if (!entries) continue;

        for (const entry of entries) {
          const content = entry.content as Record<string, unknown>;
          if (content?.entryType === "TimelineTimelineModule" && content.items) {
            for (const item of content.items as Array<Record<string, unknown>>) {
              const itemData = item.item as Record<string, unknown>;
              const itemContent = itemData?.itemContent as Record<string, unknown>;
              if (itemContent?.itemType === "TimelineUser") {
                const userResults = itemContent.user_results as Record<string, unknown>;
                const userResult = userResults?.result;
                if (userResult) {
                  const parsed = this.parseUserResponse(userResult);
                  if (parsed) users.push(parsed);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[TwitterService] Error extracting users from search:", error);
    }

    return users;
  }

  private extractTweetsFromSearch(data: unknown, keyword: string): Tweet[] {
    const tweets: Tweet[] = [];

    try {
      const instructions = this.getInstructions(data);

      for (const instruction of instructions) {
        if (instruction.type !== "TimelineAddEntries") continue;

        const entries = instruction.entries as Array<Record<string, unknown>>;
        if (!entries) continue;

        for (const entry of entries) {
          const entryId = entry.entryId as string;
          if (entryId?.startsWith("promoted-tweet") || entryId?.startsWith("who-to-follow") || entryId?.startsWith("cursor-")) {
            continue;
          }

          const content = entry.content as Record<string, unknown>;
          
          // Handle TimelineTimelineItem (direct tweet)
          if (content?.entryType === "TimelineTimelineItem") {
            const itemContent = content.itemContent as Record<string, unknown>;
            const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
            const tweetResult = tweetResults?.result as Record<string, unknown>;
            if (tweetResult && tweetResult.__typename === "Tweet") {
              const parsed = this.parseTweet(tweetResult, keyword);
              if (parsed) tweets.push(parsed);
            }
          }
          
          // Handle TimelineTimelineModule (conversation thread with nested items)
          if (content?.entryType === "TimelineTimelineModule" && content.items) {
            const items = content.items as Array<Record<string, unknown>>;
            for (const item of items) {
              const itemData = item.item as Record<string, unknown>;
              const itemContent = itemData?.itemContent as Record<string, unknown>;
              const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
              const tweetResult = tweetResults?.result as Record<string, unknown>;
              if (tweetResult && tweetResult.__typename === "Tweet") {
                const parsed = this.parseTweet(tweetResult, keyword);
                if (parsed) tweets.push(parsed);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[TwitterService] Error extracting tweets from search:", error);
    }

    return tweets;
  }

  private getInstructions(data: unknown): Array<Record<string, unknown>> {
    const d = data as Record<string, unknown>;

    // Try threaded conversation format
    const dataField = d?.data as Record<string, unknown>;
    const threaded = dataField?.threaded_conversation_with_injections_v2 as Record<string, unknown>;
    if (threaded?.instructions) {
      return (threaded.instructions || []) as Array<Record<string, unknown>>;
    }

    // Try new format
    const result = d?.result as Record<string, unknown>;
    if (result?.timeline) {
      const timeline = result.timeline as Record<string, unknown>;
      return (timeline.instructions || []) as Array<Record<string, unknown>>;
    }

    // Try original format
    const searchByRawQuery = dataField?.search_by_raw_query as Record<string, unknown>;
    const searchTimeline = searchByRawQuery?.search_timeline as Record<string, unknown>;
    const timeline = searchTimeline?.timeline as Record<string, unknown>;
    return (timeline?.instructions || []) as Array<Record<string, unknown>>;
  }

  private extractCursor(data: unknown): { top?: string; bottom?: string } | null {
    try {
      const d = data as Record<string, unknown>;

      // Direct cursor format
      if (d.cursor) {
        return d.cursor as { top?: string; bottom?: string };
      }

      // Extract from instructions
      const instructions = this.getInstructions(data);
      for (const instruction of instructions) {
        if (instruction.type !== "TimelineAddEntries") continue;

        const entries = instruction.entries as Array<Record<string, unknown>>;
        if (!entries) continue;

        for (const entry of entries) {
          const content = entry.content as Record<string, unknown>;
          if (content?.entryType === "TimelineTimelineCursor") {
            const cursorType = content.cursorType as string;
            const value = content.value as string;
            if (cursorType === "Bottom") {
              return { bottom: value };
            }
            if (cursorType === "Top") {
              return { top: value };
            }
          }
        }
      }
    } catch (error) {
      console.error("[TwitterService] Error extracting cursor:", error);
    }

    return null;
  }

  /**
   * Extract tweets from threaded conversation format
   */
  private extractTweetsFromThreadedConversation(data: unknown): Tweet[] {
    const tweets: Tweet[] = [];

    try {
      const d = data as Record<string, unknown>;
      const dataField = d?.data as Record<string, unknown>;
      const threaded = dataField?.threaded_conversation_with_injections_v2 as Record<string, unknown>;
      const instructions = (threaded?.instructions || []) as Array<Record<string, unknown>>;

      for (const instruction of instructions) {
        if (instruction.type !== "TimelineAddEntries") continue;

        const entries = instruction.entries as Array<Record<string, unknown>>;
        if (!entries) continue;

        for (const entry of entries) {
          const entryId = entry.entryId as string;
          // Skip cursor entries
          if (entryId?.startsWith("cursor-")) {
            continue;
          }

          const content = entry.content as Record<string, unknown>;
          
          // Handle TimelineTimelineItem (direct tweet)
          if (content?.entryType === "TimelineTimelineItem") {
            const itemContent = content.itemContent as Record<string, unknown>;
            const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
            const tweet = tweetResults?.result as Record<string, unknown>;

            if (tweet && tweet.__typename === "Tweet") {
              const parsed = this.parseTweet(tweet, "");
              if (parsed) tweets.push(parsed);
            }
          }
          
          // Handle TimelineTimelineModule (conversation thread with nested items)
          if (content?.entryType === "TimelineTimelineModule" && content.items) {
            const items = content.items as Array<Record<string, unknown>>;
            for (const item of items) {
              const itemData = item.item as Record<string, unknown>;
              const itemContent = itemData?.itemContent as Record<string, unknown>;
              const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
              const tweet = tweetResults?.result as Record<string, unknown>;

              if (tweet && tweet.__typename === "Tweet") {
                const parsed = this.parseTweet(tweet, "");
                if (parsed) tweets.push(parsed);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[TwitterService] Error extracting tweets from threaded conversation:", error);
    }

    return tweets;
  }
}

// Export singleton instance
export const twitterService = new TwitterService();
