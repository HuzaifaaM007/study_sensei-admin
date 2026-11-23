export interface Subject {
  subject_id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface Course {
  course_id: string;
  subject_id: string;
  title: string;
  description: string;
  level: string;
  source_url: string;
  attribution: string;
}

export interface Lesson {
  lesson_id: string;
  title: string;
  summary: string;
  content_text: string;
  order_index: number;
  estimated_minutes: number;
  difficulty: string;
  source_url: string;
  quiz_eligible: boolean;
  audio_eligible: boolean;
}

export interface BookChapter {
  title: string;
  start_page: number;
  end_page: number;
}

export interface BookUploadResponse {
  course_id: string;
  title: string;
  lessons_created: number;
  chapters_created?: number;
  /** Chapters whose page range had no extractable text, so no lessons were created for them. */
  chapters_skipped?: string[];
}

/** A course with how many chapters and lessons it holds (GET /admin/courses). */
export interface CourseOverview extends Course {
  chapter_count: number;
  lesson_count: number;
}

export interface ChapterLesson {
  lesson_id: string;
  title: string;
  order_index: number;
  estimated_minutes: number;
}

export interface ChapterInfo {
  chapter_key: string;
  position: number;
  title: string;
  /** null for lessons created before page ranges were recorded. */
  start_page: number | null;
  end_page: number | null;
  page_count: number | null;
  lesson_count: number;
  lessons: ChapterLesson[];
}

export interface CourseStructure {
  course_id: string;
  title: string;
  chapter_count: number;
  lesson_count: number;
  /** true when every chapter has a recorded page range */
  pages_recorded: boolean;
  chapters: ChapterInfo[];
}

/** A video link inside a course (GET /catalog/courses/{id}/videos). The transcript is only in VideoDetail. */
export interface CourseVideo {
  video_id: string;
  course_id: string;
  title: string;
  description: string | null;
  provider: "youtube" | "vimeo" | "direct";
  external_id: string | null;
  source_url: string;
  embed_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  attribution: string | null;
  order_index: number;
  has_transcript: boolean;
}

export interface VideoDetail extends CourseVideo {
  transcript: string | null;
  /** "vtt" keeps timestamps, "text" is plain */
  transcript_format: "vtt" | "text" | null;
}

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

export interface SessionUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;

/** "admin" is the main admin. "child_admin" accounts are created by a main admin and cannot manage admins. */
export const ROLE_ADMIN = "admin";
export const ROLE_CHILD_ADMIN = "child_admin";

export const isAdminRole = (role: string) => role === ROLE_ADMIN || role === ROLE_CHILD_ADMIN;

/** A student account (GET /admin/users). */
export interface StudentUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  lectures: number;
  quizzes: number;
  is_verified: boolean;
}

/** POST /admin/books/inspect */
export interface PdfInspection {
  total_pages: number;
  has_text: boolean;
  sampled_pages: number;
  sampled_pages_with_text: number;
  outline: { level: number; title: string; page: number }[];
  outline_supported: boolean;
}

export interface RegistrationPoint { date: string; new_users: number; total_users: number }
export interface RegistrationAnalytics {
  days: number;
  total_students: number;
  new_in_period: number;
  series: RegistrationPoint[];
}
export interface CourseAnalytics {
  course_id: string;
  title: string;
  subject: string;
  lessons: number;
  videos: number;
  lesson_views: number;
  quiz_attempts: number;
  learners: number;
  avg_score: number | null;
  engagement: number;
  level: "High" | "Medium" | "Low" | "None";
}
export interface CourseAnalyticsResponse {
  courses: CourseAnalytics[];
  summary: {
    total_courses: number;
    total_views: number;
    total_attempts: number;
    most_popular: string | null;
    highest_score: string | null;
    lowest_score: string | null;
  };
}

export interface CommentAuthor { user_id: string; name: string; is_admin: boolean; avatar_url: string | null }
export interface AdminComment {
  comment_id: string;
  body: string;
  target_type: "course" | "lesson" | "video" | "topic";
  target_id: string;
  target_title: string;
  is_reply: boolean;
  author: CommentAuthor;
  created_at: string | null;
}
export interface DiscussionTopic {
  topic_id: string;
  title: string;
  body: string;
  tag: string | null;
  is_pinned: boolean;
  is_closed: boolean;
  author: CommentAuthor;
  created_at: string | null;
  last_activity_at: string | null;
  reply_count: number;
}
export interface DiscussionStats { topics: number; comments: number; likes: number; by_target: Record<string, number> }
