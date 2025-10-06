-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create collections table (WITHOUT policies that reference other tables yet)
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Create collection_shares table BEFORE policies that reference it
CREATE TABLE public.collection_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, shared_with_user_id)
);

ALTER TABLE public.collection_shares ENABLE ROW LEVEL SECURITY;

-- NOW create collections policies that reference collection_shares
CREATE POLICY "Users can view own collections"
  ON public.collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared collections"
  ON public.collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_shares
      WHERE collection_shares.collection_id = collections.id
      AND collection_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view public collections"
  ON public.collections FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can create own collections"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
  ON public.collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
  ON public.collections FOR DELETE
  USING (auth.uid() = user_id);

-- Collection shares policies
CREATE POLICY "Users can view shares for their collections"
  ON public.collection_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_shares.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their received shares"
  ON public.collection_shares FOR SELECT
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Collection owners can create shares"
  ON public.collection_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_shares.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "Collection owners can delete shares"
  ON public.collection_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = collection_shares.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Create materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Materials policies
CREATE POLICY "Users can view materials in accessible collections"
  ON public.materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = materials.collection_id
      AND (
        c.user_id = auth.uid() 
        OR c.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.collection_shares cs
          WHERE cs.collection_id = c.id
          AND cs.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create materials in own collections"
  ON public.materials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = materials.collection_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete materials from own collections"
  ON public.materials FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE id = materials.collection_id
      AND user_id = auth.uid()
    )
  );

-- Create quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Quizzes policies
CREATE POLICY "Users can view quizzes from accessible collections"
  ON public.quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = quizzes.collection_id
      AND (
        c.user_id = auth.uid() 
        OR c.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.collection_shares cs
          WHERE cs.collection_id = c.id
          AND cs.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "System can create quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (true);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers TEXT[] NOT NULL,
  explanation TEXT,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Questions policies
CREATE POLICY "Users can view questions from accessible quizzes"
  ON public.questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.collections c ON c.id = q.collection_id
      WHERE q.id = questions.quiz_id
      AND (
        c.user_id = auth.uid() 
        OR c.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.collection_shares cs
          WHERE cs.collection_id = c.id
          AND cs.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "System can create questions"
  ON public.questions FOR INSERT
  WITH CHECK (true);

-- Create attempts table
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score INTEGER,
  total_questions INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Attempts policies
CREATE POLICY "Users can view own attempts"
  ON public.attempts FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own attempts"
  ON public.attempts FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Create answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Answers policies
CREATE POLICY "Users can view own answers"
  ON public.answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attempts
      WHERE attempts.id = answers.attempt_id
      AND (attempts.user_id = auth.uid() OR attempts.user_id IS NULL)
    )
  );

CREATE POLICY "Users can create answers"
  ON public.answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attempts
      WHERE attempts.id = answers.attempt_id
      AND (attempts.user_id = auth.uid() OR attempts.user_id IS NULL)
    )
  );

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-materials', 'study-materials', false)
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view materials in accessible collections"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-materials' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.collections c
        WHERE c.user_id::text = (storage.foldername(name))[1]
        AND (
          c.is_public = true
          OR EXISTS (
            SELECT 1 FROM public.collection_shares cs
            WHERE cs.collection_id = c.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-materials' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'study-materials' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-materials' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );