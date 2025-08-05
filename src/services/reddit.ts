import axios, { AxiosError } from 'axios';
import config from '../config/index.js';
import { handleServiceError } from '../utils/error.js';

// Create axios instance with Reddit API configuration
const redditApi = axios.create({
  baseURL: 'https://www.reddit.com',
  headers: {
    'User-Agent': 'mcp-reddit-server/1.0.0',
  },
});

// Interface for Reddit post data
interface RedditPost {
  title: string;
  url: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
}

// Interface for Reddit comment data
interface RedditComment {
  author: string;
  body: string;
  score: number;
  created_utc: number;
}

// Interface for comments response
interface CommentsResponse {
  post: RedditPost;
  comments: RedditComment[];
}

// Interface for Reddit access token response
interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Token storage
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;

// Interface for Reddit API response child data
interface RedditApiPostData {
  title: string;
  permalink: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
}

// Interface for Reddit API response child
interface RedditApiChild {
  data: RedditApiPostData;
}

// Interface for Reddit API comment data
interface RedditApiCommentData {
  author: string;
  body: string;
  score: number;
  created_utc: number;
}

// Interface for Reddit API comment child
interface RedditApiCommentChild {
  data: RedditApiCommentData;
}

// curl -X POST -d 'grant_type=password&username=USERNAME&password=PASSWORD' \
//   --user 'CLIENT_ID:CLIENT_SECRET' \
//   -A 'MyScript/0.1 by USERNAME' \
//   https://www.reddit.com/api/v1/access_token

// curl -H "Authorization: bearer ACCESS_TOKEN" \
//      -A "MyScript/0.1 by USERNAME" \
//      "https://oauth.reddit.com/r/all/hot.json?limit=5"

/**
 * Get access token from Reddit OAuth API
 * Implements password grant flow for Reddit API authentication
 */
export async function getAccessToken(): Promise<AccessTokenResponse> {
  try {
    const { clientId, clientSecret, username, password, userAgent } =
      config.reddit;

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error(
        'Reddit credentials not configured. Please set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, and REDDIT_PASSWORD environment variables.'
      );
    }

    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'password',
        username,
        password,
      }),
      {
        headers: {
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: clientId,
          password: clientSecret,
        },
      }
    );

    const tokenData: AccessTokenResponse = response.data;

    // Store token and expiration time
    accessToken = tokenData.access_token;
    tokenExpiresAt = Date.now() + tokenData.expires_in * 1000 - 60000; // Refresh 1 minute early

    // Update axios instance to use Bearer token for authenticated endpoints
    redditApi.defaults.headers.common['Authorization'] =
      `Bearer ${accessToken}`;
    redditApi.defaults.baseURL = 'https://oauth.reddit.com';

    return tokenData;
  } catch (error) {
    handleServiceError(error, {}, 'Failed to get Reddit access token');
  }
}

/**
 * Check if current token is valid and not expired
 */
function isTokenValid(): boolean {
  return (
    accessToken !== null &&
    tokenExpiresAt !== null &&
    Date.now() < tokenExpiresAt
  );
}

/**
 * Ensure we have a valid access token, refresh if necessary
 */
async function ensureValidToken(): Promise<void> {
  if (!isTokenValid()) {
    await getAccessToken();
  }
}

/**
 * Make an authenticated API request with automatic token refresh on auth errors
 */
async function makeAuthenticatedRequest<T>(
  requestFn: () => Promise<T>,
  context: Record<string, unknown>,
  errorMessage: string
): Promise<T> {
  await ensureValidToken();

  try {
    return await requestFn();
  } catch (error) {
    // Check if it's an authentication error
    if (
      error instanceof AxiosError &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      // Token might be expired, try refreshing once
      await getAccessToken();
      try {
        return await requestFn();
      } catch (retryError) {
        handleServiceError(retryError, context, errorMessage);
      }
    } else {
      handleServiceError(error, context, errorMessage);
    }
  }
}

// Transform Reddit API response data to our format
const transformPostData = (child: RedditApiChild): RedditPost => ({
  title: child.data.title,
  url: 'https://reddit.com' + child.data.permalink,
  author: child.data.author,
  subreddit: child.data.subreddit,
  score: child.data.score,
  num_comments: child.data.num_comments,
});

export async function searchPosts(
  query: string,
  limit: number = 10
): Promise<RedditPost[]> {
  return makeAuthenticatedRequest(
    async () => {
      const response = await redditApi.get(
        `/search.json?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      const children = response.data.data.children;
      return children.map(transformPostData);
    },
    { query, limit },
    'Failed to search Reddit posts'
  );
}

export async function hotAll(limit: number = 10): Promise<RedditPost[]> {
  return makeAuthenticatedRequest(
    async () => {
      const response = await redditApi.get(`/r/all/hot.json?limit=${limit}`);
      const children = response.data.data.children;
      return children.map(transformPostData);
    },
    { limit },
    'Failed to get hot posts from all subreddits'
  );
}

export async function hotBySub(
  subreddit: string,
  limit: number = 10
): Promise<RedditPost[]> {
  return makeAuthenticatedRequest(
    async () => {
      const response = await redditApi.get(
        `/r/${subreddit}/hot.json?limit=${limit}`
      );
      const children = response.data.data.children;
      return children.map(transformPostData);
    },
    { subreddit, limit },
    'Failed to get hot posts from subreddit'
  );
}

export async function newBySub(
  subreddit: string,
  limit: number = 10
): Promise<RedditPost[]> {
  return makeAuthenticatedRequest(
    async () => {
      const response = await redditApi.get(
        `/r/${subreddit}/new.json?limit=${limit}`
      );
      const children = response.data.data.children;
      return children.map(transformPostData);
    },
    { subreddit, limit },
    'Failed to get new posts from subreddit'
  );
}

export async function comments(
  subreddit: string,
  postId: string
): Promise<CommentsResponse> {
  return makeAuthenticatedRequest(
    async () => {
      const response = await redditApi.get(
        `/r/${subreddit}/comments/${postId}.json`
      );

      // Extract post data from first element
      const postData = transformPostData(response.data[0].data.children[0]);

      // Extract comments from second element
      const commentsData: RedditComment[] = response.data[1].data.children.map(
        (comment: RedditApiCommentChild) => ({
          author: comment.data.author,
          body: comment.data.body,
          score: comment.data.score,
          created_utc: comment.data.created_utc,
        })
      );

      return {
        post: postData,
        comments: commentsData,
      };
    },
    { subreddit, postId },
    'Failed to get comments for Reddit post'
  );
}
