<?php
require_once __DIR__ . '/../../helpers.php';
cors();

require_admin();

// Roles are fixed: exactly one super admin, everyone else is a standard
// user. There is no path — UI or API — to create a second admin.
json_err('Role changes are disabled. There is a single fixed super admin account.', 403);
