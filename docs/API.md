# API reference

All endpoints use JSON. Mutations require `X-Requested-With: EMS`. Authentication uses the `ems_session` HttpOnly cookie. Cross-origin API access is disabled.

| Method | Path             | Access      | Purpose                                                   |
| ------ | ---------------- | ----------- | --------------------------------------------------------- |
| GET    | `/api/health`    | Public      | Health check                                              |
| POST   | `/api/login`     | Public      | `{email,password}`; start eight-hour session              |
| GET    | `/api/me`        | Signed in   | Current user without password hash                        |
| POST   | `/api/logout`    | Signed in   | Revoke session                                            |
| GET    | `/api/workspace` | Signed in   | Users, tasks, latest 20 activity records; employee scoped |
| POST   | `/api/password`  | Signed in   | `{current,password}`; revoke other sessions               |
| POST   | `/api/users`     | Admin       | `{name,email,password,department}`; create employee       |
| PATCH  | `/api/users/:id` | Admin       | `{active:boolean}`; deactivate/reactivate employee        |
| POST   | `/api/tasks`     | Admin       | Create task                                               |
| PUT    | `/api/tasks/:id` | Admin       | Replace task content and assignment; retain status        |
| PATCH  | `/api/tasks/:id` | Owner/admin | `{status}`; transition task                               |
| DELETE | `/api/tasks/:id` | Admin       | Remove task permanently                                   |

Task content: `{title,description,assignee,due,priority,category}`. Due dates are valid `YYYY-MM-DD` dates; priority is `low`, `medium` or `high`; assignee must be an active employee.

Employee transitions: `new -> active -> completed` or `new -> active -> failed`. The UI calls `failed` **Blocked**. Administrators can reopen tasks. Status updates compare the previous state to avoid silently overwriting concurrent changes.

Errors return `{error: "Actionable message"}` with an appropriate HTTP status. Unexpected errors return a generic 500 without stack traces. Employee emails are unique and normalized to lowercase. Deactivation revokes sessions and retains task/history records.

## Signup and onboarding

See [onboarding endpoints and Google configuration](ONBOARDING.md). `/api/signup` creates a new administrator and private workspace; `/api/setup` completes profile/workspace setup. All existing workspace, task, employee and activity endpoints now enforce the session workspace. IDs from another workspace cannot be used to read or change its records.
