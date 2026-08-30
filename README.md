# BOAT COMMAND v0.13.2 — GENERATOR SESSION FIX

Screenshot diagnostic:
`FAILED · GENERATOR · Can't find variable: getSession`

Root cause:
v0.13.x generator called a nonexistent `getSession()` helper.
The existing app session accessor is `currentSession()`.

Fix:
- generator session read -> currentSession()
- post-render verification session read -> currentSession()
- 5-stage diagnostics retained
- no HARD LOCK automation
- no result reveal
- cache bust v=132
