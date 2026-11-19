'use strict';

// bcrypt cost for new password hashes. Real accounts always get 12. The automated suites set
// NODE_ENV=test themselves before loading the app, and each throwaway sign-up there would otherwise
// burn ~0.3 s of CPU in pure-JS bcryptjs; the minimum cost still runs the real algorithm (including
// the 72-byte limit). A Render deployment never takes the shortcut, even if NODE_ENV were mistyped.
// Stored hashes carry their own cost, so compare() is unaffected and no existing password changes.
function passwordHashCost() {
    return process.env.NODE_ENV === 'test' && process.env.RENDER !== 'true' ? 4 : 12;
}

module.exports = { passwordHashCost };
