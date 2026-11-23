# THIRAN (திறன்) - Backend API Documentation

Backend service for **THIRAN (திறன்)** – Online Learning Platform.

Built with **Node.js**, **Express.js**, **MySQL (mysql2)**, **bcryptjs**, and **jsonwebtoken (JWT)**.

---

## 1. Project Architecture

```
THIRAN/
├── backend/
│   ├── config/
│   │   └── db.js                 # MySQL pool & database connection manager
│   ├── controllers/
│   │   ├── authController.js     # User registration and login controller
│   │   └── blogController.js     # Blog creation, list, and details controller
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT Bearer token authentication middleware
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth routes
│   │   └── blogRoutes.js         # /api/blogs routes
│   ├── .env                      # Environment configuration
│   ├── .env.example              # Template environment variables
│   ├── .gitignore                # Git ignore rules
│   ├── database.sql              # MySQL schema & tables initialization script
│   ├── package.json              # Project metadata & npm dependencies
│   ├── server.js                 # Express server bootstrap & middleware
│   ├── test-api.js               # Automated 9-endpoint testing harness
│   └── README.md                 # Backend documentation & setup guide
├── css/                          # Frontend CSS (preserved)
├── js/                           # Frontend JS (integrated with backend API)
├── index.html                    # Homepage
├── login.html                    # Student Sign In
├── register.html                 # Student Registration
├── courses.html                  # Course Catalog
├── course-details.html           # Course details & lessons
├── dashboard.html                # Student Dashboard
├── my-learning.html              # Enrolled courses
└── profile.html                  # Student Profile
```

---

## 2. Technology Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (v4.21+)
- **Database:** MySQL 8.0+
- **Database Driver:** `mysql2/promise` (connection pooling & parameterized queries)
- **Password Hashing:** `bcryptjs` (salt rounds: 10)
- **Authentication:** `jsonwebtoken` (JWT Bearer tokens)
- **Configuration:** `dotenv`
- **Cross-Origin Requests:** `cors`
- **Development Monitor:** `nodemon`

---

## 3. Database Setup (MySQL)

1. Open your MySQL client (Command Line or MySQL Workbench).
2. Run the initialization script provided in `backend/database.sql`:

```sql
CREATE DATABASE IF NOT EXISTS thiran_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE thiran_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  phone VARCHAR(20) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_blogs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_blogs_user_id (user_id),
  INDEX idx_blogs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Environment Configuration

Create or update `backend/.env` with your local database credentials:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=thiran_db
DB_PORT=3306
JWT_SECRET=thiran_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

> **Note:** If MySQL credentials are not yet configured or MySQL service is starting up, the backend automatically operates in graceful fallback mode to ensure endpoints and authentication remain testable and reliable without crashing.

---

## 5. Running the Backend

From the `backend/` directory:

### Install Dependencies:
```bash
npm install
```

### Start in Production Mode:
```bash
npm start
```

### Start in Development Mode (Auto-reload with nodemon):
```bash
npm run dev
```

The server runs on **`http://localhost:5000`**.

---

## 6. API Reference

### Health Check
- **`GET /api/health`**
  - **Description:** Verifies service status, uptime, and database connectivity.
  - **Response (200 OK):**
    ```json
    {
      "status": "OK",
      "message": "THIRAN backend service is operational.",
      "timestamp": "2026-11-23T19:28:19.962Z",
      "uptime": "15 seconds",
      "database": "Connected (MySQL)"
    }
    ```

---

### Authentication Endpoints

#### 1. User Registration
- **`POST /api/auth/register`**
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "full_name": "Karthik Raja",
    "email": "karthik@thiran.edu",
    "phone": "+91 98765 43210",
    "password": "password123",
    "confirm_password": "password123"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "user": {
      "id": 1,
      "full_name": "Karthik Raja",
      "email": "karthik@thiran.edu",
      "phone": "+91 98765 43210",
      "created_at": "2026-11-23T19:28:20.104Z"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Missing fields, invalid email format, short password, or mismatched passwords)
  - `409 Conflict` (Email address already registered)

#### 2. User Login
- **`POST /api/auth/login`**
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "email": "karthik@thiran.edu",
    "password": "password123"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "full_name": "Karthik Raja",
      "email": "karthik@thiran.edu",
      "phone": "+91 98765 43210",
      "created_at": "2026-11-23T19:28:20.104Z"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Email or password missing)
  - `401 Unauthorized` (Invalid email or password)

---

### Blog Endpoints

#### 1. Create Blog Post (Protected)
- **`POST /api/blogs`**
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "title": "Getting Started with Full Stack Engineering",
    "content": "Mastering modern web protocols and databases in THIRAN."
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Blog post created successfully.",
    "blog": {
      "id": 1,
      "title": "Getting Started with Full Stack Engineering",
      "content": "Mastering modern web protocols and databases in THIRAN.",
      "created_at": "2026-11-23T19:28:20.297Z",
      "updated_at": "2026-11-23T19:28:20.297Z",
      "author_id": 1,
      "author_name": "Karthik Raja",
      "author_email": "karthik@thiran.edu"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Missing title or content)
  - `401 Unauthorized` (Missing, invalid, or expired JWT token)

#### 2. Get All Blogs (Public)
- **`GET /api/blogs`**
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "blogs": [
      {
        "id": 1,
        "title": "Getting Started with Full Stack Engineering",
        "content": "Mastering modern web protocols and databases in THIRAN.",
        "created_at": "2026-11-23T19:28:20.297Z",
        "updated_at": "2026-11-23T19:28:20.297Z",
        "author_id": 1,
        "author_name": "Karthik Raja",
        "author_email": "karthik@thiran.edu"
      }
    ]
  }
  ```

#### 3. Get Blog by ID (Public)
- **`GET /api/blogs/:id`**
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "blog": {
      "id": 1,
      "title": "Getting Started with Full Stack Engineering",
      "content": "Mastering modern web protocols and databases in THIRAN.",
      "created_at": "2026-11-23T19:28:20.297Z",
      "updated_at": "2026-11-23T19:28:20.297Z",
      "author_id": 1,
      "author_name": "Karthik Raja",
      "author_email": "karthik@thiran.edu"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Invalid blog ID format)
  - `404 Not Found` (Blog ID does not exist)

---

## 7. Automated Testing Suite

To run the automated 9-point verification test:
```bash
cd backend
npm test
```

### Verified Test Cases:
1. `GET /api/health` - Server health verification.
2. `POST /api/auth/register` - User registration with bcrypt hashing.
3. `POST /api/auth/register` (Duplicate) - Rejection with HTTP 409.
4. `POST /api/auth/login` - Valid credential authentication & JWT token generation.
5. `POST /api/auth/login` (Invalid) - Rejection with HTTP 401.
6. `POST /api/blogs` (With JWT) - Authenticated post creation & author association.
7. `POST /api/blogs` (Without JWT) - Rejection with HTTP 401 Unauthorized.
8. `GET /api/blogs` - Querying all posts with author metadata.
9. `GET /api/blogs/:id` - Querying single post by ID.

---

## 8. Frontend Integration Notes

- `login.html` connects to `POST /api/auth/login` via `js/auth.js`.
- `register.html` connects to `POST /api/auth/register` via `js/auth.js`.
- On successful login, the JWT Bearer token is stored under key `thiran_auth_token` in `localStorage`.
- Existing course catalog, student enrollments, lessons, player, profile, and certificates are fully preserved.
