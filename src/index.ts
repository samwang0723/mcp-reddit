#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  TextContent,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import config from './config/index.js';
import * as redditService from './services/reddit.js';

// Load environment variables
dotenv.config();

class McpServerApp {
  private createServer(): McpServer {
    const server = new McpServer({
      name: 'mcp-reddit-server',
      version: '1.0.0',
    });

    // Register Reddit tools
    server.tool(
      'reddit-search',
      'Search Reddit posts by query',
      {
        query: z.string().describe('Search query for Reddit posts'),
        limit: z
          .number()
          .optional()
          .describe('Number of results to return (default 10)'),
      },
      async ({ query, limit }) => {
        try {
          const result = await redditService.searchPosts(query, limit || 10);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              } as TextContent,
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Error executing reddit-search: ${errorMessage}`);
        }
      }
    );

    server.tool(
      'reddit-hot-all',
      'Get hot posts from all subreddits',
      {
        limit: z
          .number()
          .optional()
          .describe('Number of results to return (default 10)'),
      },
      async ({ limit }) => {
        try {
          const result = await redditService.hotAll(limit || 10);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              } as TextContent,
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Error executing reddit-hot-all: ${errorMessage}`);
        }
      }
    );

    server.tool(
      'reddit-hot-subreddit',
      'Get hot posts from a specific subreddit',
      {
        subreddit: z.string().describe('Subreddit name (without r/ prefix)'),
        limit: z
          .number()
          .optional()
          .describe('Number of results to return (default 10)'),
      },
      async ({ subreddit, limit }) => {
        try {
          const result = await redditService.hotBySub(subreddit, limit || 10);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              } as TextContent,
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `Error executing reddit-hot-subreddit: ${errorMessage}`
          );
        }
      }
    );

    server.tool(
      'reddit-new-subreddit',
      'Get newest posts from a specific subreddit',
      {
        subreddit: z.string().describe('Subreddit name (without r/ prefix)'),
        limit: z
          .number()
          .optional()
          .describe('Number of results to return (default 10)'),
      },
      async ({ subreddit, limit }) => {
        try {
          const result = await redditService.newBySub(subreddit, limit || 10);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              } as TextContent,
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `Error executing reddit-new-subreddit: ${errorMessage}`
          );
        }
      }
    );

    server.tool(
      'reddit-comments',
      'Get comments for a specific Reddit post',
      {
        subreddit: z.string().describe('Subreddit name (without r/ prefix)'),
        postId: z.string().describe('Reddit post ID'),
      },
      async ({ subreddit, postId }) => {
        try {
          const result = await redditService.comments(subreddit, postId);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              } as TextContent,
            ],
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Error executing reddit-comments: ${errorMessage}`);
        }
      }
    );

    return server;
  }

  async run() {
    const app = express();
    app.use(express.json());

    // Map to store transports by session ID for stateful connections
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } =
      {};

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'mcp-reddit-server' });
    });

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req, res) => {
      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;
        let server: McpServer;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: sessionId => {
              // Store the transport by session ID
              transports[sessionId] = transport;
            },
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          // Create new server instance
          server = this.createServer();

          // Connect to the MCP server
          await server.connect(transport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (
      req: express.Request,
      res: express.Response
    ) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    // Start the server
    app.listen(config.server.port, '0.0.0.0', () => {
      console.log(
        `MCP Reddit Server running on http://0.0.0.0:${config.server.port}`
      );
      console.log(
        `Health check available at http://0.0.0.0:${config.server.port}/health`
      );
      console.log(
        `MCP endpoint available at http://0.0.0.0:${config.server.port}/mcp`
      );
    });
  }
}

// Start the server
const server = new McpServerApp();
server.run().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
