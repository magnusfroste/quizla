-- Create analysis_progress table for real-time progress tracking
CREATE TABLE IF NOT EXISTS public.analysis_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  current_page INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL,
  current_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime for the analysis_progress table
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_progress;

-- Enable Row Level Security
ALTER TABLE public.analysis_progress ENABLE ROW LEVEL SECURITY;

-- Users can view progress for their own collections
CREATE POLICY "Users can view their own analysis progress"
  ON public.analysis_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE collections.id = analysis_progress.collection_id
        AND collections.user_id = auth.uid()
    )
  );

-- System can insert progress records (used by edge function)
CREATE POLICY "System can create analysis progress"
  ON public.analysis_progress FOR INSERT
  WITH CHECK (true);

-- System can update progress records
CREATE POLICY "System can update analysis progress"
  ON public.analysis_progress FOR UPDATE
  USING (true);

-- System can delete old progress records
CREATE POLICY "System can delete analysis progress"
  ON public.analysis_progress FOR DELETE
  USING (true);

-- Add trigger to automatically update updated_at timestamp
CREATE TRIGGER update_analysis_progress_updated_at
  BEFORE UPDATE ON public.analysis_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();