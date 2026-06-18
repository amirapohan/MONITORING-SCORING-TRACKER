# Team Matching Postman Pack

This pack is built from the real Team Matching Service source code.

## Files

- `team-matching.collection.json` - importable Postman collection
- `team-matching.environment.json` - environment variables

## Important notes

- The Team Matching Service itself does not expose register/login endpoints. For demo flow, use the external Identity & SSO service first, then set `clientToken` and `clientId` from the login response.
- The internal route `/internal/check-team/:student_id` requires `x-service-key`, not a bearer token.
- The route `PUT /invites/:id/respond` exists twice in source: once in `src/app.js` and once in `src/routes/teamRoutes.js`. The app-level route is mounted first.

## Recommended import order

1. Import `team-matching.environment.json`
2. Import `team-matching.collection.json`
3. Set `clientToken`, `clientId`, `serviceKey`, and any runtime IDs such as `teamId`, `inviteId`, and `requestId`

## Runtime variables saved by the collection

- `studentId`
- `userId`
- `clientId`
- `teamId`
- `inviteId`
- `requestId`
- `period`
- `targetStudentId`
- `inviteeStudentId`

## Safety order

1. `GET /me`
2. `POST /pool`
3. `PUT /profile/skills`
4. `POST /teams`
5. `PUT /teams/:id/required-skills`
6. Invite or join-request flow
7. Recommendation and member-management flow
8. `DELETE /pool/me` last if you want to keep the demo state clean
