# Authentication Architecture (DORA SaaS)

This document outlines the authentication and authorization flows in the DORA SaaS platform, specifically highlighting how NextJS/React Native (if used) or standard React SPA clients interact with the NestJS API.

## Overview
The platform uses a **Stateless JWT (JSON Web Token)** architecture. This approach enables horizontal scaling of the backend without relying on sticky sessions or centralized session stores like Redis. 

Tokens are transmitted and verified simultaneously via **HttpOnly Cookies** and **Bearer Headers**, ensuring both robust API client compatibility and secure browser context behaviors.

## Authentication Flow

1. **Login (`POST /api/v1/auth/login`)**
   - The user submits their email and password.
   - The `AuthService` verifies the credentials using `bcrypt.compare` against the `passwordHash` stored in the `users` table.
   - Upon success, the backend generates a short-lived or long-lived (if "remember me" is selected) JWT containing the `sub` (User ID), `email`, `role`, and `tenantId`.
   - The token is returned in the JSON response payload AND automatically set as a secure `HttpOnly` Cookie (`access_token`).

2. **Session Persistence (`GET /api/v1/auth/me`)**
   - When the frontend Single Page Application (SPA) reloads, the React `authStore` initializes and calls `/auth/me`.
   - This endpoint utilizes the unified `JwtAuthGuard` to verify the active session. This strategy parses the token from EITHER the `Authorization: Bearer <token>` header OR the `access_token` cookie.
   - If valid, it binds the stripped, secure User object to the request context. 

3. **Logout (`POST /api/v1/auth/logout`)**
   - The frontend clears its local memory (`localStorage` and Zustand store state).
   - The backend explicitly issues a clear-cookie directive for `access_token` to instruct the browser to drop the secure session.

4. **Token Expiration & Client Catching**
   - If a token expires naturally or is invalid, the backend guards throw a `401 Unauthorized` exception.
   - The global `apiClient.interceptors.response` in the React app intercepts any 401 response (except those originating from `/auth/login` or `/auth/logout`) and forcefully purges the local session, resetting the UI back to the login screen.

## Security Considerations

- **XSS Mitigation:** Using `HttpOnly` cookies for browser-based navigation adds a layer of protection against rogue Javascript reading the token via Cross-Site Scripting.
- **Data Minimization:** The `JwtStrategy` explicitly strips critical secret columns such as `passwordHash` and `resetToken` before binding the Context User. An additional check drops incoming requests completely if their account is marked `'DEACTIVATED'`.
- **Stateless Verification:** All verification is mathematical (cryptographic signature verification via `process.env.JWT_SECRET`). Database hits inside the Strategy are solely for expanding role objects and checking deactivations.

## Role-Based Access Control (RBAC)

The system manages 3 explicit roles:
- `ADMIN`: Global scope access, user management, and read-only validation execution.
- `ANALYST`: Write-access for running validation rules and flagged reviews.
- `EDITOR`: Data-entry focused role capable of editing entity properties and resolving flags.

Roles are embedded into the active JWT payload (`req.user.role`). The frontend utilizes `components/RoleGuard` to limit UI access, while the backend can read `request.user.role` from the strategy layer to protect specific endpoints.
