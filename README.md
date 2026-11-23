# Study Sensei Admin Panel

Next.js 14 + TypeScript + Tailwind. Talks to the Study Sensei FastAPI backend and uses the same
dark theme as the Flutter app.

## What it does

| Page | Features |
|---|---|
| Login | Admin-only sign in (students are rejected). Tokens refresh automatically. |
| Overview | Subject and course counts, shortcuts |
| Subjects | Create, rename, delete (warns how many courses will be deleted with it) |
| Courses | Create (existing or brand-new subject), edit, delete, filter by subject, search. Each course shows its chapter and lesson counts |
| Course page | Chapters per course, the PDF pages each chapter covers, the lessons inside each chapter, delete a single chapter, delete the whole course |
| Lessons | Pick a course, create, edit, delete, preview text, move up/down, quiz/audio switches |
| Upload book | PDF + subject/course details + chapter page ranges, upload progress, result link. Page ranges are saved, and chapters with no extractable text are reported |
| Course videos | On the course page: add video links (YouTube, Vimeo or a direct .mp4/.webm/.mov/.m3u8 link) with title, description, duration, credit and an optional transcript (paste or load .txt/.vtt/.srt). Live preview, reorder, edit, delete |
| Child admins | Main admin only: create, edit (name, email, password reset), disable/enable, delete child admin accounts |

## Admin roles

* **Main admin** (`admin`): created by listing the email in `ADMIN_EMAILS` before registering. Can do everything, including managing child admins.
* **Child admin** (`child_admin`): created from the Child admins page. Can sign in and manage subjects, courses, chapters, lessons and book uploads, but cannot see or call the child admin endpoints.
* Disabling a child admin, or resetting their password, signs them out immediately.
* A child admin who has used the student app (quizzes, lectures) cannot be deleted; disable them instead.

## Course videos

Videos are links, not uploads: the video stays on YouTube/Vimeo. For YouTube use **Unlisted** (anyone with the link can watch, it stays out of search) and keep **Allow embedding** on. "Private" videos cannot be played in an app. A transcript is optional; `.vtt` and `.srt` files keep their timestamps (stored as WebVTT). Backend needs the new `course_videos` table: run `python create_video_table.py` once.

## Chapters and pages

Chapters are not a separate table. When a book is uploaded, each chapter's title and page range are saved on its lessons, and the course page groups them back. Courses uploaded **before** this change have no saved page ranges: they show their chapters (grouped from "(Part N)" lesson titles) with "Pages not recorded". Upload the book again to record pages.

## Setup

Requires Node 18.17 or newer.

```bash
npm install
cp .env.local.example .env.local      # Windows PowerShell: Copy-Item .env.local.example .env.local
npm run dev
```

Open http://localhost:3000 and log in with an admin account.

`.env.local` holds the backend address:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Restart `npm run dev` after changing it.

## Backend requirements

1. **Admin account.** The email must be listed in the backend's `ADMIN_EMAILS` before it is registered
   (role is assigned at registration). Register it through the backend's `/docs` page or the app.
2. **CORS.** The backend's `.env` must allow this site, then restart uvicorn by hand (`.env` changes are not
   picked up by `--reload`):
   ```
   CORS_ORIGINS=["http://localhost:3000"]
   ```
3. The backend must have the catalog admin endpoints (create/update/delete for subjects, courses and lessons)
   and `POST /catalog/books/upload`, plus the new `/admin/...` endpoints (course structure, delete chapter,
   child admins). No database migration is needed.

## Production build

```bash
npm run build
npm run start
```

Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend address before building, and add this site's address
to the backend's `CORS_ORIGINS`.

## Security note

The login guard runs in the browser and only keeps non-admins away from the screens. The real protection is
that every admin endpoint on the backend requires an admin token, so a visitor without one cannot change data.
Tokens are kept in `localStorage`; use this panel on a trusted machine.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| "Cannot reach http://localhost:8000..." | Backend not running, wrong `NEXT_PUBLIC_API_BASE_URL`, or the address is missing from `CORS_ORIGINS` (check the browser console for a CORS error). |
| "This account does not have admin access" | The email was not in `ADMIN_EMAILS` when the account was registered. Register a new account after adding it. |
| Sent back to login after a while | The session expired and refreshing failed. Log in again. |
| Upload says "No text could be extracted" | The PDF is scanned (images of pages), or the page ranges are beyond the book. Use a text-based PDF or run OCR first. |
| Upload is slow | The server extracts text page by page. 30 pages takes seconds; hundreds of pages can take a minute or more. |
| `npm run dev` fails with a Node error | Upgrade Node to 18.17 or newer. |
