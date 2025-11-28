import type { Json } from "@/integrations/supabase/types";

// Collection types
export interface Collection {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  materials?: Material[];
}

export interface CreateCollectionData {
  title: string;
  description?: string;
}

// Material types
export interface Material {
  id: string;
  collection_id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  material_type: 'content' | 'learning_objectives' | 'reference';
  created_at: string;
}

export interface MaterialAnalysis {
  id: string;
  material_id: string;
  collection_id: string;
  page_number: number | null;
  extracted_text: string;
  major_topics: string[];
  key_concepts: string[];
  definitions: Json | null;
  formulas: string[] | null;
  visual_elements: string[] | null;
  emphasis_markers: string[] | null;
  is_foundational: boolean | null;
  token_count: number | null;
  analyzed_at: string | null;
}

// Quiz types
export interface Quiz {
  id: string;
  collection_id?: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  collections?: { id: string; title: string };
  attempts?: Array<{ id: string; completed_at: string | null }>;
  attemptCount?: number;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  correct_answer: string;
  wrong_answers: string[];
  explanation: string | null;
  order_index: number;
  difficulty_level?: string | null;
  bloom_level?: string | null;
  question_type?: string | null;
  topic_category?: string | null;
  exam_likelihood?: string | null;
  exam_tip?: string | null;
  page_references?: string[] | null;
}

export interface Attempt {
  id: string;
  user_id?: string | null;
  quiz_id?: string;
  score: number | null;
  total_questions: number;
  completed_at: string | null;
  created_at?: string;
  quiz?: {
    title: string;
    collection?: { title: string };
  };
}

export interface Answer {
  id?: string;
  attempt_id?: string;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
}

// User types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Analytics types
export interface TopicStats {
  topic: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface Analytics {
  attempts: Attempt[];
  totalAttempts: number;
  averageScore: number;
  sharedQuizzes: number;
  topicStats: TopicStats[];
}

// Upload types
export interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'compressing' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
  materialType: 'content' | 'learning_objectives' | 'reference';
}

// Analysis progress
export interface AnalysisProgress {
  current_page: number;
  total_pages: number;
  current_file_name: string | null;
}

// Subscription types
export type UserPlan = 'free' | 'student' | 'pro';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: UserPlan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// App config types
export interface AppConfigItem {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}
