import axios from 'axios';
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

// Transform Reddit API response data to our format
const transformPostData = (child: any): RedditPost => ({
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
  try {
    const response = await redditApi.get(
      `/search.json?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    const children = response.data.data.children;
    return children.map(transformPostData);
  } catch (error) {
    handleServiceError(
      error,
      { query, limit },
      'Failed to search Reddit posts'
    );
  }
}

export async function hotAll(limit: number = 10): Promise<RedditPost[]> {
  try {
    const response = await redditApi.get(`/r/all/hot.json?limit=${limit}`);
    const children = response.data.data.children;
    return children.map(transformPostData);
  } catch (error) {
    handleServiceError(
      error,
      { limit },
      'Failed to get hot posts from all subreddits'
    );
  }
}

export async function hotBySub(
  subreddit: string,
  limit: number = 10
): Promise<RedditPost[]> {
  try {
    const response = await redditApi.get(
      `/r/${subreddit}/hot.json?limit=${limit}`
    );
    const children = response.data.data.children;
    return children.map(transformPostData);
  } catch (error) {
    handleServiceError(
      error,
      { subreddit, limit },
      'Failed to get hot posts from subreddit'
    );
  }
}

export async function newBySub(
  subreddit: string,
  limit: number = 10
): Promise<RedditPost[]> {
  try {
    const response = await redditApi.get(
      `/r/${subreddit}/new.json?limit=${limit}`
    );
    const children = response.data.data.children;
    return children.map(transformPostData);
  } catch (error) {
    handleServiceError(
      error,
      { subreddit, limit },
      'Failed to get new posts from subreddit'
    );
  }
}

export async function comments(
  subreddit: string,
  postId: string
): Promise<CommentsResponse> {
  try {
    const response = await redditApi.get(
      `/r/${subreddit}/comments/${postId}.json`
    );

    // Extract post data from first element
    const postData = transformPostData(response.data[0].data.children[0]);

    // Extract comments from second element
    const commentsData: RedditComment[] = response.data[1].data.children.map(
      (comment: any) => ({
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
  } catch (error) {
    handleServiceError(
      error,
      { subreddit, postId },
      'Failed to get comments for Reddit post'
    );
  }
}
