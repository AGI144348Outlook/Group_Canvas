# Next integration work

The runnable prototype was built at Timothy's request after the contract draft arrived. There were no existing implementation modules in Group_Canvas to overwrite; the draft contract is preserved.

For Claude's integration review: inspect the shared seams in `src/auth/index.js`, `src/providers/index.js`, `src/agents/index.js`, `src/api.js` and `src/storage.js`. Replace or extend these modules behind the current command contract. The prototype does not finalize sign-in, accounts, BYOK, billing, or production quotas.

First acceptance work: run the browser smoke test in an unrestricted development environment; run Wrangler against the intended local DO runtime; verify a direct provider turn using an explicitly authorized key. Keep model secrets out of the repository. Neither repository publication nor a passing test suite is a Cloudflare deployment.
