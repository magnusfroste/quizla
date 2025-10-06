-- Add foreign key constraints with CASCADE to ensure data integrity

-- materials.collection_id -> collections.id
ALTER TABLE public.materials
DROP CONSTRAINT IF EXISTS materials_collection_id_fkey,
ADD CONSTRAINT materials_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES public.collections(id) 
  ON DELETE CASCADE;

-- collection_shares.collection_id -> collections.id
ALTER TABLE public.collection_shares
DROP CONSTRAINT IF EXISTS collection_shares_collection_id_fkey,
ADD CONSTRAINT collection_shares_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES public.collections(id) 
  ON DELETE CASCADE;

-- collection_shares.shared_with_user_id -> profiles.id
ALTER TABLE public.collection_shares
DROP CONSTRAINT IF EXISTS collection_shares_shared_with_user_id_fkey,
ADD CONSTRAINT collection_shares_shared_with_user_id_fkey 
  FOREIGN KEY (shared_with_user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- quizzes.collection_id -> collections.id
ALTER TABLE public.quizzes
DROP CONSTRAINT IF EXISTS quizzes_collection_id_fkey,
ADD CONSTRAINT quizzes_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES public.collections(id) 
  ON DELETE CASCADE;

-- questions.quiz_id -> quizzes.id
ALTER TABLE public.questions
DROP CONSTRAINT IF EXISTS questions_quiz_id_fkey,
ADD CONSTRAINT questions_quiz_id_fkey 
  FOREIGN KEY (quiz_id) 
  REFERENCES public.quizzes(id) 
  ON DELETE CASCADE;

-- attempts.quiz_id -> quizzes.id
ALTER TABLE public.attempts
DROP CONSTRAINT IF EXISTS attempts_quiz_id_fkey,
ADD CONSTRAINT attempts_quiz_id_fkey 
  FOREIGN KEY (quiz_id) 
  REFERENCES public.quizzes(id) 
  ON DELETE CASCADE;

-- attempts.user_id -> profiles.id (nullable, so only add FK if value exists)
ALTER TABLE public.attempts
DROP CONSTRAINT IF EXISTS attempts_user_id_fkey,
ADD CONSTRAINT attempts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- answers.attempt_id -> attempts.id
ALTER TABLE public.answers
DROP CONSTRAINT IF EXISTS answers_attempt_id_fkey,
ADD CONSTRAINT answers_attempt_id_fkey 
  FOREIGN KEY (attempt_id) 
  REFERENCES public.attempts(id) 
  ON DELETE CASCADE;

-- answers.question_id -> questions.id
ALTER TABLE public.answers
DROP CONSTRAINT IF EXISTS answers_question_id_fkey,
ADD CONSTRAINT answers_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions(id) 
  ON DELETE CASCADE;