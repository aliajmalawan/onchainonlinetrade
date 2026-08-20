# KYC Status System Implementation

## Overview
The KYC status system has been completely redesigned to follow the same pattern as the withdrawal status system. Instead of a boolean `verified` field, the system now uses a 3-state ENUM column `kyc_status` in the `users` table.

## Database Schema Changes

### Before
```sql
verified TINYINT(1) NOT NULL DEFAULT 0    -- 0 = unverified, 1 = verified
kyc_status TINYINT(1) NOT NULL DEFAULT 1  -- 0 = verified, 1 = unverified, 2 = rejected (confusing!)
```

### After
```sql
kyc_status ENUM('unverify', 'verify', 'rejected') NOT NULL DEFAULT 'unverify'
-- verified column is dropped
```

**Status Meanings:**
- `unverify` - User has not completed KYC or KYC is still pending
- `verify` - User's KYC has been verified by admin
- `rejected` - User's KYC has been rejected by admin

## System Architecture

### 1. Admin Dashboard Flow
**File:** `src/pages/admin/Users.jsx`

```
Admin selects status (Verify/Unverify/Rejected)
    ↓
calls apiAdminUpdateKycStatus(userId, status)
    ↓
Backend: POST /api/admin/update_kyc_status.php
    ↓
Updates users.kyc_status in database
Updates kyc_documents status
Sends notification if rejected
    ↓
Response: { ok: true }
    ↓
Frontend: refresh() called
    ↓
UI updated with new status
```

### 2. User Dashboard Profile Menu Flow
**File:** `src/components/ProfileMenu.jsx`

```
User clicks Profile dropdown
    ↓
refreshUser() called automatically
    ↓
Backend: GET /api/me.php
    ↓
public_user() function returns:
{
  kycStatus: 'verify' | 'unverify' | 'rejected'
}
    ↓
ProfileMenu renders kyc-badge with appropriate class
    ↓
Display example:
- 'verify'    → Green badge with ✓
- 'unverify'  → Red badge with !
- 'rejected'  → Dark red badge with ✕
```

### 3. Other Components Update Flow

**Topbar.jsx, Notifications.jsx, WithdrawHistory.jsx**

These components listen to the user state and automatically display appropriate messages based on `user.kycStatus` value.

## API Endpoints

### New Endpoint
- **POST** `/api/admin/update_kyc_status.php`
  - Accepts: `{ userId: int, kycStatus: string }`
  - Values: `'verify'`, `'unverify'`, `'rejected'`
  - Response: `{ ok: true }`
  - Updates: `users.kyc_status` column
  - Side effects: Updates kyc_documents, sends notifications

### Updated Endpoints (Backward Compatible)
- **POST** `/api/admin/update_verified.php` - Maps old numeric values to new ENUM
- **POST** `/api/admin/update_user_status.php` - Updated to use kyc_status ENUM

## Frontend API Functions

### New Function
```javascript
export const apiAdminUpdateKycStatus = (userId, kycStatus) => 
  request('/admin/update_kyc_status.php', { 
    method: 'POST', 
    body: { userId, kycStatus } 
  })
```

### Comparison with Withdrawal System
```javascript
// Withdrawal Status (Pattern to Follow)
export const apiAdminUpdateWithdrawStatus = (withdrawId, status, txId = null, fee = null) =>
  request('/admin/update_withdraw_status.php', { method: 'POST', body: { withdrawId, status, txId, fee } })

// KYC Status (New - Same Pattern)
export const apiAdminUpdateKycStatus = (userId, kycStatus) =>
  request('/admin/update_kyc_status.php', { method: 'POST', body: { userId, kycStatus } })
```

## CSS Classes

```css
.kyc-pill {
  /* Base styling for all KYC badges */
}

.kyc-verify {
  /* Green badge for verified status */
  background: rgba(34,197,94,0.12);
  color: var(--up);
  border-color: rgba(34,197,94,0.22);
}

.kyc-unverify {
  /* Red badge for unverified status */
  background: rgba(239,68,68,0.12);
  color: var(--down);
  border-color: rgba(239,68,68,0.22);
}

.kyc-rejected {
  /* Dark red badge for rejected status */
  background: rgba(185,28,28,0.12);
  color: #b91c1c;
  border-color: rgba(125,29,29,0.22);
}
```

## Files Modified

### Backend
1. `backend/setup_db.php` - Database schema migration
2. `backend/api/admin/update_kyc_status.php` - NEW endpoint
3. `backend/api/admin/update_user_status.php` - Updated for ENUM
4. `backend/api/admin/update_verified.php` - Backward compatible mapping
5. `backend/helpers.php` - Returns kycStatus as string

### Frontend
6. `src/lib/backend.js` - New API client function
7. `src/components/ProfileMenu.jsx` - Updated badge display logic
8. `src/components/Topbar.jsx` - Updated status checks
9. `src/pages/account/Notifications.jsx` - Updated status checks
10. `src/pages/account/WithdrawHistory.jsx` - Updated status checks
11. `src/pages/admin/Users.jsx` - Admin UI updated
12. `src/styles/global.css` - New CSS classes

### Utilities
13. `tmp_unverify_user.php` - Updated for new ENUM

## Backward Compatibility

- Old `verified` boolean field: Dropped from database (migration handles it)
- Old numeric values (0, 1, 2): Still accepted by `update_verified.php` endpoint but mapped to new ENUM values
- Old API consumers: Will continue to work but should migrate to new endpoint

## Migration from Old System

**Automatic Migration (via setup_db.php):**
- `verified = 1` → `kyc_status = 'verify'`
- `verified = 0` AND `status != 'rejected'` → `kyc_status = 'unverify'`
- `status = 'rejected'` → `kyc_status = 'rejected'`

## Implementation Checklist

✅ Database schema updated (ENUM column)
✅ Old `verified` column dropped
✅ New backend endpoint created
✅ Admin UI updated with 3-option dropdown
✅ Frontend API function added
✅ User dashboard badge displays correct status
✅ All components use new ENUM values
✅ CSS classes defined
✅ Notifications updated
✅ WithdrawHistory component updated
✅ Backward compatibility maintained

## Testing Checklist

- [ ] Run `php backend/setup_db.php` to apply migrations
- [ ] Admin changes KYC status → Database updates immediately
- [ ] User opens Profile Menu → Status badge displays correctly
- [ ] Admin rejects user → Notification sent to user
- [ ] Logout/Login → New status persists
- [ ] WithdrawHistory shows status correctly
- [ ] Topbar notifications show correct KYC status messages
- [ ] All 3 status options work (verify, unverify, rejected)

## Similar Implementation Pattern

This implementation follows the exact same pattern as the withdrawal status system:

### Withdrawal Status
- Column: `withdraw_history.status` (ENUM: 'pending', 'completed', 'failed')
- Endpoint: `/api/admin/update_withdraw_status.php`
- Admin UI: Select dropdown with 3 options
- User display: Status updates automatically

### KYC Status (New)
- Column: `users.kyc_status` (ENUM: 'unverify', 'verify', 'rejected')
- Endpoint: `/api/admin/update_kyc_status.php`
- Admin UI: Select dropdown with 3 options
- User display: Status updates automatically via badge

## Notes

- Migration script handles all data conversion automatically
- No manual SQL queries needed
- Backward compatible with old API endpoints
- UI updates are real-time (uses refreshUser mechanism)
- Notifications sent on status change (rejection only)
- KYC documents status synced with user KYC status
