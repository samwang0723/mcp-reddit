# MCP Reddit Server

Reddit MCP server that provides tools to interact with Reddit.

## 🚀 Features

- **TypeScript**: Full type safety with modern TypeScript patterns.
- **Reddit Tools**: A suite of tools to search posts, get hot/new posts, and view comments.
- **HTTP Transport**: RESTful API with Express.js for MCP communication.
- **Session Management**: Stateful connections with proper session handling.
- **Configuration Management**: Environment-based configuration using `.env` files.
- **Error Handling**: Comprehensive error handling and logging.
- **Health Checks**: Built-in `/health` monitoring endpoint.
- **Docker Support**: Production-ready containerization with a `Dockerfile`.

## 📋 Prerequisites

- Node.js 20+
- npm

## 🛠️ Quick Start

```bash
# 1. Clone the repository
git clone git@github.com:samwang0723/mcp-reddit.git
cd mcp-reddit

# 2. Install dependencies
npm install

# 3. Create an environment file
# Copy .env.example if it exists, or create a new .env file
# For this project, it's optional, but good practice.
touch .env

# 4. Start the development server
npm run dev
```

The server will be running at `http://localhost:3000` (or the port specified in your `.env` file).

## 🔧 Environment Configuration

Create a `.env` file in the root directory to override default settings:

```env
# Server Configuration
PORT=3000
LOG_LEVEL=info
```

## 📜 Development Scripts

- `npm run dev`: Start the development server with hot reload using `tsx`.
- `npm run build`: Compile TypeScript to JavaScript for production.
- `npm start`: Run the compiled production server.
- `npm run test`: Run Jest tests.
- `npm run lint`: Lint the codebase using ESLint.
- `npm run lint:fix`: Automatically fix linting issues.
- `npm run quality`: Run type-checking, linting, and formatting checks.

## 🏗️ Project Structure

```
mcp-reddit/
├── src/
│   ├── config/           # Configuration management
│   │   └── index.ts
│   ├── services/         # Core application logic (e.g., Reddit API interaction)
│   │   └── reddit.ts
│   ├── utils/            # Utility functions (logging, error handling)
│   │   ├── error.ts
│   │   └── logger.ts
│   └── index.ts          # Main server application and MCP tool registration
├── Dockerfile            # Docker configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## 🏛️ Architecture

### Core Components

1.  **McpServerApp**: The main application class in `src/index.ts` that configures and runs the MCP server.
2.  **Express.js**: Handles HTTP requests, routing, and middleware.
3.  **MCP SDK**: The `@modelcontextprotocol/sdk` provides the core functionality for creating MCP servers and tools.
4.  **Reddit Service**: `src/services/reddit.ts` contains the logic for interacting with the public Reddit JSON API.
5.  **Session Management**: Stateful HTTP-based sessions are managed to handle conversations.

### HTTP Endpoints

- `GET /health`: Health check endpoint.
- `POST /mcp`: Main MCP endpoint for receiving requests from clients.
- `GET /mcp`: Endpoint for server-to-client notifications via Server-Sent Events (SSE).
- `DELETE /mcp`: Endpoint for clients to terminate their session.

## 🛠️ Available Tools

The server exposes several tools for interacting with Reddit.

### `reddit-search`

Search Reddit posts by a query.

- **Parameters**:
  - `query` (string, required): Search query for Reddit posts.
  - `limit` (number, optional): Number of results to return (default 10).

### `reddit-hot-all`

Get hot posts from all subreddits (r/all).

- **Parameters**:
  - `limit` (number, optional): Number of results to return (default 10).

### `reddit-hot-subreddit`

Get hot posts from a specific subreddit.

- **Parameters**:
  - `subreddit` (string, required): Subreddit name (without the `r/` prefix).
  - `limit` (number, optional): Number of results to return (default 10).

### `reddit-new-subreddit`

Get the newest posts from a specific subreddit.

- **Parameters**:
  - `subreddit` (string, required): Subreddit name (without the `r/` prefix).
  - `limit` (number, optional): Number of results to return (default 10).

### `reddit-comments`

Get the comments for a specific Reddit post.

- **Parameters**:
  - `subreddit` (string, required): Subreddit name where the post resides.
  - `postId` (string, required): The ID of the post.

## 🐳 Docker Deployment

You can build and run the server in a Docker container.

```bash
# 1. Build the Docker image
docker build -t mcp-reddit-server .

# 2. Run the container
# You can pass environment variables directly or use --env-file
docker run -p 3000:3000 -e PORT=3000 mcp-reddit-server
```

## 🧪 Testing

Run the test suite using Jest:

```bash
# Run all tests
npm test
```

Create new test files in your project ending with `.test.ts` to add more tests.
