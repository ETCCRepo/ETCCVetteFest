<?php
// Destroys the shared PHP session (see index.php/lib.php's vettefest_authenticated
// flag) and returns to this app's own login screen — used by the hamburger
// menu's "Logout" item (LIVE mode only, see App/src/app.js's buildHeaderMenu()).
//
// Used to redirect off-site to the club's main website instead. Changed at
// the user's request (2026-09-14): that read as the app/website "closing"
// rather than logging out, especially as an installed/bookmarked shortcut —
// index.php is the same file that already serves the login form for any
// unauthenticated request, so redirecting to it (relative, same directory)
// is the "return to main menu" a logout should actually do.
session_start();
session_unset();
session_destroy();
header('Location: index.php');
exit;
