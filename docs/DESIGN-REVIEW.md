# EMS interface review

Reviewed 5 November 2026. Scope: sign-in, overview, task list/board/details/create/edit/delete, employee access, activity and settings. Stack: React, custom CSS tokens and Lucide icons. No EMS AGENTS.md or design-system document existed; SwiftCause styles do not apply to this separate repository.

## Direction

A quiet work journal: warm off-white, forest-green actions, a pale olive progress surface, system sans-serif UI and a restrained serif display accent. The product information leads. No external photographs or fonts are needed.

Taste Skill informed the visual direction; Better Interface supplied the domain checks; Superfuture Design Review supplied the ten-dimension craft rubric. Marketing-only screen-height, shader and asset-dealing instructions were not applied to the operational workspace. No paid review service or telemetry was used.

## Scope and coverage

| Domain        | Evidence inspected                                                                                             | Result                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Accessibility | Native dialogs, wrapping labels, focus styles, keyboard Escape, axe checks on login/all five screens/task form | No automated WCAG A/AA violations in tested states       |
| Layout        | Rendered overview at 1440, 1024, 768, 390 and 320px; all workspace screens at 390px                            | No page-level horizontal overflow in tested states       |
| Writing       | Labels, task actions, validation, empty states, confirmation and error recovery                                | Clear action labels; destructive actions confirmed       |
| Typography    | Login, overview, task list, profile renders and CSS                                                            | Two font families; 16px inputs prevent mobile focus zoom |
| Colors        | Rendered axe contrast checks, status badges and focus styling                                                  | Tested text pairs pass; statuses also have text          |
| UI polish     | Shared buttons, cards, Lucide icons, reduced-motion rule, modal scrolling                                      | Consistent component states                              |

## Findings resolved

| Severity | Domain        | Location                            | Before                                                           | After                                  | Why                                               |
| -------- | ------------- | ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| HIGH     | Accessibility | `src/ui/Modal.jsx`                  | First input did not receive keyboard focus                       | Explicit initial focus after showModal | Form entry must work without a pointer            |
| HIGH     | Layout        | `src/index.css`, task table         | Absolutely positioned hidden header expanded the mobile document | Containing block on table scroller     | Prevent page-level horizontal scrolling           |
| HIGH     | Layout        | `src/index.css`, mobile navigation  | Later navigation items extended beyond a scroll edge             | Wrapped grid navigation                | All destinations stay visibly available           |
| MEDIUM   | Layout        | `src/App.jsx`, workspace navigation | Programmatic focus scrolled the sticky sidebar unexpectedly      | Focus with preventScroll               | Stable page composition on screen changes         |
| MEDIUM   | Layout        | `src/index.css`, task table         | Additional columns had only an accessible scroll description     | Visible narrow-screen scroll cue       | Pointer users can discover the additional columns |
| LOW      | UI            | `src/App.jsx`, sidebar              | Mixed Unicode symbols                                            | One Lucide icon family                 | Consistent visual weight                          |

The first keyboard and narrow-screen tests failed before these fixes and passed afterward.

## Verification

- `npm run test:e2e`: four browser scenarios, including the full admin-to-employee task lifecycle, team creation, board/search/export, deletion confirmation, keyboard entry/Escape and responsive layouts.
- Automated axe checks: login, five workspace screens and the task creation dialog, WCAG 2 A/AA and 2.1 AA tags.
- Screenshots inspected: login desktop, overview desktop/320px, tasks desktop/390px, team desktop and settings mobile. Additional generated captures remain in ignored test-results.
- Source checks: empty/error/loading states, accessible names, native controls, reduced-motion override and permanent deletion confirmation.

Not verified: manual screen-reader output, iOS Safari, forced-colors mode, actual 200% browser zoom, translated/RTL layouts and every combination of custom text length. Automated checks do not establish complete WCAG conformance. The marketing-specific Taste Skill checker is not applicable to these workspace layouts and was not run.

## Strengths

- Task information and primary actions have a consistent hierarchy.
- Shared surfaces, restrained color and a readable display accent establish an identity.
- Mobile navigation stays visible; dialogs use the platform's focus trapping and Escape behavior.
- Task permissions live on the server, independently of screen visibility.

## Verdict

Approve for the inspected portfolio-demo surfaces: no known HIGH findings remain. The manual assistive-technology/browser coverage listed above is not claimed.
