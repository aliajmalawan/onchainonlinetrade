# OnChainTrade — Backend (PHP + MySQL)

A small, framework-free REST API for the OnChainTrade React app. Token-based
auth (no PHP sessions — avoids the whole session/output-buffering headache),
hashed passwords, and clean PDO prepared statements.

## Setup

1. **Start MySQL** (XAMPP Control Panel -> Start MySQL).
2. **Configure** `config.php` if your MySQL user/password differ from XAMPP's
   defaults (`root` / empty password).
3. **Create the database + demo admin:**
   ```bash
   php setup_db.php
   ```
4. **Run the API** (from the project root, so the path points at ./backend):
   ```bash
   php -S localhost:8000 -t backend
   ```
   The API is now at `http://localhost:8000/api/...`

## Endpoints

| Method | Path                          | Auth   | Purpose                    |
| ------ | ----------------------------- | ------ | -------------------------- |
| POST   | /api/register.php             | –      | Create account, get token  |
| POST   | /api/login.php                | –      | Log in, get token          |
| POST   | /api/logout.php               | token  | Invalidate token           |
| GET    | /api/me.php                   | token  | Current user               |
| GET    | /api/portfolio.php            | token  | List holdings              |
| POST   | /api/portfolio.php            | token  | Add a holding (merges into an existing row for the same coin — amount summed, buy price weighted-averaged) |
| DELETE | /api/portfolio.php?id=123     | token  | Sell/remove a holding — body `{amount, price}` sells part of it (a Trade), omit to remove it entirely |
| GET    | /api/trade_history.php        | token  | Your own add/update/remove activity log |
| POST   | /api/update_password.php      | token  | Change your own password (requires current password) |
| POST   | /api/update_account.php       | token  | Update your own name/email |
| GET    | /api/support_chat.php         | token  | Your own support chat thread |
| POST   | /api/support_chat.php         | token  | Send a message to support  |
| GET    | /api/admin/users.php          | admin  | List all users             |
| POST   | /api/admin/update_role.php    | admin  | Disabled — always 403. Roles are fixed (one super admin, rest are users) |
| POST   | /api/admin/delete_user.php    | admin  | Delete a user              |
| POST   | /api/admin/add_holding.php    | admin  | Add a holding to a user's portfolio (same merge behavior as above) |
| GET    | /api/admin/user_holdings.php?userId=1 | admin | List a user's holdings |
| POST   | /api/admin/update_holding.php | admin  | Adjust a holding's amount (record correction, not a transfer) |
| POST   | /api/admin/delete_holding.php | admin  | Remove a holding entirely  |
| POST   | /api/admin/impersonate.php    | admin  | Get a session token for a user ("login as") — never touches their password |
| GET    | /api/admin/support_chats.php  | admin  | List conversations, newest activity first |
| GET    | /api/admin/support_chat.php?userId=1 | admin | Full thread with one user |
| POST   | /api/admin/support_chat.php   | admin  | Reply to a user as support |

Send the token as a header:  `Authorization: Bearer <token>`

## Connect the React frontend

1. Copy `frontend-integration/api.js` into the React app at `src/lib/backend.js`.
2. Add to the frontend `.env`:
   ```
   VITE_BACKEND_URL=http://localhost:8000/api
   ```
3. Replace the localStorage calls in `AuthContext.jsx` and the portfolio/admin
   pages with the async `api*` functions (add `await` + a little loading state).
   Ask Claude Code: "wire AuthContext and the pages to src/lib/backend.js".

## Security notes (this is now the real thing)

- Passwords are hashed with `password_hash()` — never stored in plain text.
- Tokens are random 32-byte values with an expiry; logout deletes them.
- All queries use prepared statements (no SQL injection).
- CORS is limited to the origins in `config.php` — tighten these in production.
- For production: serve over HTTPS, set a strong DB password, and consider
  rate-limiting the login endpoint.