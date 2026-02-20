# Team-695-api

A comprehensive backend API service for FRC Team 695, providing authentication, task management, feedback collection, and integration with The Blue Alliance (TBA) data.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Module Overview](#module-overview)
- [Development](#development)
- [Scripts](#scripts)
- [Contributing](#contributing)

## Features

- 🔐 **Authentication & Authorization** - Casdoor integration with JWT and API Key authentication
- 📝 **Task Assignment System** - Create, manage, and track scouting assignments
- 💬 **Feedback Collection** - User feedback with email notifications
- 🤖 **TBA Integration** - Webhook support and data sync with The Blue Alliance
- 📊 **Survey System** - Collect and manage survey responses
- 🖼️ **Image Upload** - Cloudflare R2 storage integration
- 📈 **Team & Match Data** - Store and query FRC team and match information
- 📱 **Scoutify Data Bridge** - Read Scoutify Android app data via a dedicated secondary database connection
- 🔒 **Rate Limiting & Security** - Helmet.js, CORS, and request rate limiting
- 📖 **API Documentation** - Swagger/OpenAPI documentation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MySQL 2
- **Cache**: Redis (for token blacklist)
- **Authentication**: Casdoor (OAuth 2.0)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: Nodemailer
- **Documentation**: Swagger UI

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **pnpm** (recommended) or npm - Install pnpm: `npm install -g pnpm`
- **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
- **Redis** (v6 or higher) - [Download](https://redis.io/download/)
- **Git** - [Download](https://git-scm.com/)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/1834423612/Team-695-api.git
cd Team-695-api
```

2. **Install dependencies**

Using pnpm (recommended):
```bash
pnpm install
```

Or using npm:
```bash
npm install
```

### Environment Configuration

1. **Copy the example environment file**

```bash
cp .example.env .env
```

2. **Configure your `.env` file** with the following required settings:

#### Database Configuration
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_NAME=your_db_name
DB_PASSWORD=your_secure_password

# Scoutify secondary database (required for Scoutify endpoints)
SCOUTIFY_DB_HOST=localhost
SCOUTIFY_DB_PORT=3306
SCOUTIFY_DB_USER=root
SCOUTIFY_DB_NAME=teamsixn_scouting_dev
SCOUTIFY_DB_PASSWORD=your_secure_password
SCOUTIFY_DB_CONNECTION_LIMIT=50
```

#### Email Configuration
Configure SMTP settings for sending feedback notifications:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
ADMIN_EMAIL=admin@example.com
```

#### Casdoor Authentication
Set up Casdoor for user authentication:
```env
CASDOOR_ENDPOINT=https://example.com
CASDOOR_CLIENT_ID=your_client_id
CASDOOR_CLIENT_SECRET=your_client_secret
CASDOOR_ORG_NAME=your_org_name
CASDOOR_APP_NAME=your_app_name
JWT_ISSUER=https://example.com
JWT_AUDIENCE=your_client_id
CASDOOR_CERTIFICATE="-----BEGIN CERTIFICATE-----
...your certificate here...
-----END CERTIFICATE-----"
```

#### Redis Configuration
```env
REDIS_URL=redis://localhost:6379
```

#### Image Upload (Cloudflare R2)
```env
R2_BUCKET_NAME=team695-images
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
CUSTOM_DOMAIN=https://images.team695.com
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
UPLOAD_DIR=uploads/images
```

#### The Blue Alliance (TBA) Integration
```env
TBA_READ_API_KEY=your_tba_api_key
TBA_WEBHOOK_SECRET=your_webhook_secret
SKIP_TBA_HMAC_VERIFY=false
```

#### Server Configuration
```env
PORT=3000

# QoS / Rate limit overrides (optional)
# If omitted, defaults from config/qos.ts are used
QOS_API_PER_SECOND=30
QOS_API_PER_MINUTE=900
QOS_AUTH_PER_SECOND=8
QOS_AUTH_PER_MINUTE=120
QOS_FEEDBACK_PER_SECOND=2
QOS_FEEDBACK_PER_MINUTE=30
QOS_SCOUTIFY_PUBLIC_PER_SECOND=12
QOS_SCOUTIFY_PUBLIC_PER_MINUTE=300
```

### Database Setup

1. **Create the database**

Connect to MySQL and create the database:
```sql
CREATE DATABASE team_695_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **Import the schema**

Execute the SQL schema file to create tables:
```bash
mysql -u root -p team_695_db < Database.sql
```

The schema includes tables for:
- `feedback` - User feedback submissions
- `task_assignments` - Scouting task assignments
- `teams` - FRC team information
- `matches` - Match data from events
- `surveys` - Survey responses
- And more...

3. **Verify tables**

```sql
USE team_695_db;
SHOW TABLES;
```

### Running the Application

#### Development Mode (with auto-reload)

```bash
pnpm dev
```

This starts the server with nodemon, which automatically restarts on file changes.

#### Production Mode

```bash
pnpm start
```

The server will start on the port specified in your `.env` file (default: 3000).

You should see:
```
Server running on http://localhost:3000
API documentation available at http://localhost:3000/api-docs
```

#### Verify Installation

1. Open your browser and navigate to: `http://localhost:3000`
2. Access API documentation at: `http://localhost:3000/api-docs`
3. Test the health endpoint: `http://localhost:3000/api/info/status`

## Project Structure

```
Team-695-api/
├── app.ts                    # Application entry point and Express setup
├── package.json              # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── Database.sql             # Database schema
├── .example.env             # Example environment variables
│
├── config/                  # Configuration files
│   ├── casdoor.ts          # Casdoor authentication config
│   └── database.ts         # MySQL connection pool
│
├── controllers/            # Request handlers
│   ├── assignmentController.ts  # Task assignment logic
│   ├── authController.ts        # Authentication endpoints
│   └── feedbackController.ts    # Feedback handling
│
├── middlewares/            # Express middlewares
│   ├── auth.ts            # JWT/API Key authentication
│   ├── apiKeyAuth.ts      # API Key validation
│   ├── webhookAuth.ts     # TBA webhook HMAC verification
│   └── rateLimiter.ts     # Rate limiting configuration
│
├── models/                # Data models
│   └── feedback.ts        # Feedback data model
│
├── routes/                # API route definitions
│   ├── apiInfoRoutes.ts   # API information endpoints
│   ├── assignmentRoutes.ts # Task assignment routes
│   ├── authRoutes.ts      # Authentication routes
│   ├── eventRoutes.ts     # Event data routes
│   ├── feedbackRoutes.ts  # Feedback submission routes
│   ├── surveyRoutes.ts    # Survey routes
│   ├── teamRoutes.ts      # Team data routes
│   ├── teamMatchesRoutes.ts # Team match routes
│   ├── uploadRoutes.ts    # Image upload routes
│   ├── webhookRoutes.ts   # TBA webhook routes
│   └── info/              # Info sub-routes
│       ├── endpointsRoutes.ts # Endpoint listing
│       ├── infoRoutes.ts      # General info
│       └── statusRoutes.ts    # Health check
│
├── services/              # Business logic services
│   ├── assignmentService.ts     # Task assignment operations
│   ├── authService.ts           # Authentication logic
│   ├── emailService.ts          # Email sending
│   └── tokenBlacklistService.ts # Token revocation with Redis
│
├── scripts/               # Utility scripts
│   └── updateTeamsFromTBA.ts # Sync team data from TBA
│
├── swagger/               # API documentation
│   └── Docs.yaml         # OpenAPI/Swagger specification
│
├── templates/            # Email templates
│   └── feedbackEmailTemplate.html # Feedback notification email
│
├── types/                # TypeScript type definitions
│   ├── assignment.ts     # Assignment types
│   ├── casdoor.d.ts     # Casdoor SDK types
│   └── index.ts         # Shared types
│
├── utils/                # Helper utilities
│   ├── healthCheck.ts   # System health monitoring
│   ├── responses.ts     # Standardized API responses
│   └── swaggerCache.ts  # Swagger documentation caching
│
└── public/              # Static files
    ├── index.html       # API landing page
    └── index-example.html # Example page
```

## API Documentation

Once the server is running, access the interactive API documentation:

**Swagger UI**: `http://localhost:3000/api-docs`

The documentation provides:
- Complete endpoint reference
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Try-it-out functionality

### Key API Endpoints

#### Authentication
- `GET /api/auth/callback` - OAuth callback handler
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/logout` - Revoke token

#### Task Assignments
- `POST /api/assignments` - Create new assignment (admin)
- `GET /api/assignments/:eventKey/:userId` - Get user assignments
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment (admin)

#### Feedback
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback` - Get all feedback (admin)
- `GET /api/feedback/:id` - Get specific feedback

#### Teams & Matches
- `GET /api/team/:teamNumber` - Get team information
- `GET /api/team-matches/:eventKey` - Get matches for event
- `GET /api/event/:eventKey` - Get event details

#### Scoutify
- `GET /api/scoutify/user/me` - Get current Casdoor user to Scoutify binding
- `GET /api/scoutify/user/me/android-device` - Get current user's `um_android_device_id`
- `PATCH /api/scoutify/user/me/android-device` - Update current user's `um_android_device_id`
- `GET /api/scoutify/game-matchups` - Query Scoutify `game_matchup`
- `GET /api/scoutify/game-details` - Query Scoutify `game_details`
- `GET /api/scoutify/event-assignments` - Query current user's `event_teams_user_assignment`
- `GET /api/scoutify/event-tasks` - Query current user's `event_task_tracker`
- `PATCH /api/scoutify/admin/users/:teamNumber/:scoutifyUserId/android-device` - Admin update/clear device ID
- `POST|PUT|DELETE /api/scoutify/admin/game-details` - Admin create/update/delete game details
- `POST|DELETE /api/scoutify/admin/event-assignments` - Admin create(delete via body key) assignments
- `POST /api/scoutify/admin/event-tasks` - Admin create task
- `PUT|DELETE /api/scoutify/admin/event-tasks/:taskId` - Admin update/delete task

#### Webhooks
- `POST /api/webhook` - TBA webhook receiver
- `GET /api/webhook/status` - Webhook status

#### Image Upload
- `POST /api/upload` - Upload image
- `DELETE /api/upload/images/:filename` - Delete image (authenticated)

## Module Overview

### 1. Authentication Module (`middlewares/auth.ts`, `services/authService.ts`)

**Purpose**: Secure API access using Casdoor OAuth 2.0

**Features**:
- JWT token validation
- API Key/Secret authentication
- Token blacklist with Redis
- Admin privilege checking
- Session management

**Key Functions**:
- `verifyToken`: Combined middleware (API Key → JWT fallback)
- `getUserInfoWithApiKey`: Authenticate with API credentials
- `revokeToken`: Logout and blacklist tokens

### 2. Task Assignment System (`controllers/assignmentController.ts`, `services/assignmentService.ts`)

**Purpose**: Manage scouting task assignments for events

**Features**:
- Create assignments for specific teams/matches
- Support multiple assignees
- Track assignment status (pending/in_progress/completed/canceled)
- Filter assignments by event and user

**Data Structure**:
```typescript
{
  id: string,
  event_key: string,
  task_type: 'scouting' | 'pit-scouting',
  assigned_team_numbers: number[],
  assignees_data: UserData[],
  status: string,
  notes: string
}
```

### 3. Feedback System (`controllers/feedbackController.ts`, `models/feedback.ts`)

**Purpose**: Collect user feedback and suggestions

**Features**:
- Anonymous or authenticated submissions
- Email notifications to admins
- Device info tracking (IP, user agent, screen size)
- HTML email templates
- Timestamp in EDT timezone

**Workflow**:
1. User submits feedback via POST `/api/feedback`
2. System captures device information
3. Feedback saved to database
4. Email sent to configured admin addresses

### 4. TBA Integration (`routes/webhookRoutes.ts`, `middlewares/webhookAuth.ts`)

**Purpose**: Receive and process The Blue Alliance webhook notifications

**Features**:
- HMAC signature verification
- Real-time event updates
- Match result notifications
- Team data synchronization

**Supported Webhooks**:
- `ping` - Connection test
- `verification` - Webhook verification
- Event updates, match results, etc.

**Security**: All webhooks are validated with HMAC-SHA256 signatures.

### 5. Image Upload (`routes/uploadRoutes.ts`)

**Purpose**: Handle image uploads to Cloudflare R2

**Features**:
- Multiple image format support (PNG, JPG, JPEG, HEIC, GIF)
- File size validation
- Unique filename generation
- S3-compatible storage
- Custom domain support

**Upload Flow**:
1. Client uploads image via POST `/api/upload`
2. File validated (type, size)
3. Stored in R2 bucket with unique name
4. Returns public URL

### 6. Database Service (`config/database.ts`)

**Purpose**: MySQL connection pool management

**Features**:
- Connection pooling for performance
- Automatic reconnection
- Query execution helpers
- Transaction support

### 7. Email Service (`services/emailService.ts`)

**Purpose**: Send transactional emails

**Features**:
- SMTP configuration
- HTML template support
- Timezone conversion (EDT)
- Multiple recipient support

### 8. Token Blacklist (`services/tokenBlacklistService.ts`)

**Purpose**: Revoke JWT tokens before expiration

**Features**:
- Redis-based storage
- Automatic expiration based on token TTL
- Fast lookup for validation

### 9. Health Check (`utils/healthCheck.ts`)

**Purpose**: Monitor system health

**Checks**:
- Database connectivity
- Redis availability
- Server responsiveness
- System uptime

**Endpoint**: `GET /api/info/status`

### 10. Rate Limiting (`middlewares/rateLimiter.ts`)

**Purpose**: Prevent API abuse

**Configuration**:
- Two-layer QoS (per-second + per-minute)
- Default thresholds in `config/qos.ts`
- Optional `.env` overrides via `QOS_*` variables
- IP-based tracking with standard `RateLimit-*` headers

## Development

### Code Style

The project uses TypeScript with strict type checking. Key conventions:

- Use `async/await` for asynchronous operations
- Proper error handling with try-catch blocks
- Standardized responses via `utils/responses.ts`
- JSDoc comments for public functions

### Adding a New Endpoint

1. **Create route file** in `routes/`
2. **Define controller** in `controllers/`
3. **Add service logic** in `services/` (if needed)
4. **Register route** in `app.ts`
5. **Document** in `swagger/Docs.yaml`

Example:
```typescript
// routes/exampleRoutes.ts
import { Router } from 'express';
import exampleController from '../controllers/exampleController';
import { verifyToken } from '../middlewares/auth';

const router = Router();
router.get('/example', verifyToken, exampleController.getExample);

export default router;
```

### Database Migrations

When modifying the database schema:

1. Update `Database.sql`
2. Test migration on development database
3. Document changes in commit message
4. Update relevant TypeScript types

### Testing Webhooks Locally

Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Configure TBA webhooks to point to your ngrok URL:
```
https://your-subdomain.ngrok.io/api/webhook
```

## Scripts

Available npm/pnpm scripts:

- `pnpm start` - Start production server
- `pnpm dev` - Start development server with auto-reload
- `pnpm update-teams` - Sync team data from TBA API

### Update Teams from TBA

To fetch latest team information from The Blue Alliance:

```bash
pnpm update-teams
```

This script:
- Fetches teams from TBA API
- Updates database with latest info
- Requires `TBA_READ_API_KEY` in `.env`

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Commit Message Format

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## License

This project is licensed under the MIT License.

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: Team 695

---

**Note**: This is an active development project for FRC Team 695. Some features may be in development or require additional configuration.