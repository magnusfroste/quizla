-- Allow public (anonymous) read access to public quizzes and their questions
-- Note: Existing policies remain intact; these only broaden SELECT for public content.

-- Create policy to allow anyone to view quizzes where is_public = true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'quizzes' 
      AND policyname = 'Public can view public quizzes'
  ) THEN
    CREATE POLICY "Public can view public quizzes"
    ON public.quizzes
    FOR SELECT
    USING (is_public = true);
  END IF;
END $$;

-- Create policy to allow anyone to view questions that belong to public quizzes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'questions' 
      AND policyname = 'Public can view questions for public quizzes'
  ) THEN
    CREATE POLICY "Public can view questions for public quizzes"
    ON public.questions
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.quizzes q
        WHERE q.id = questions.quiz_id
          AND q.is_public = true
      )
    );
  END IF;
END $$;