-- Create material_analysis table to store extracted content
CREATE TABLE public.material_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  
  -- Extracted content
  extracted_text TEXT NOT NULL,
  major_topics TEXT[] NOT NULL DEFAULT '{}',
  key_concepts TEXT[] NOT NULL DEFAULT '{}',
  definitions JSONB DEFAULT '{}',
  formulas TEXT[] DEFAULT '{}',
  
  -- Structure metadata
  visual_elements TEXT[] DEFAULT '{}',
  emphasis_markers TEXT[] DEFAULT '{}',
  is_foundational BOOLEAN DEFAULT false,
  page_number INTEGER,
  
  -- Analysis metadata
  token_count INTEGER,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(material_id)
);

-- Enable RLS
ALTER TABLE public.material_analysis ENABLE ROW LEVEL SECURITY;

-- Users can view analysis for accessible collections
CREATE POLICY "Users can view analysis for accessible collections"
  ON public.material_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = material_analysis.collection_id
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

-- System can create and update analysis
CREATE POLICY "System can create analysis"
  ON public.material_analysis FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update analysis"
  ON public.material_analysis FOR UPDATE
  USING (true);

-- Indexes for fast lookups
CREATE INDEX idx_material_analysis_collection ON public.material_analysis(collection_id);
CREATE INDEX idx_material_analysis_material ON public.material_analysis(material_id);