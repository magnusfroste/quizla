-- Add material_type enum to materials table
DO $$ BEGIN
  CREATE TYPE material_type AS ENUM ('content', 'learning_objectives', 'reference');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add material_type column with default value
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS material_type material_type NOT NULL DEFAULT 'content';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_materials_type ON public.materials(material_type);

-- Add learning_objectives field to material_analysis
ALTER TABLE public.material_analysis
ADD COLUMN IF NOT EXISTS learning_objectives text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.materials.material_type IS 'Type of material: content (study material), learning_objectives (study plans/goals), or reference (supporting material)';
COMMENT ON COLUMN public.material_analysis.learning_objectives IS 'Extracted learning goals and objectives from learning_objectives type materials';