-- Add optional enhanced metadata columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS difficulty_level TEXT,
ADD COLUMN IF NOT EXISTS exam_likelihood TEXT,
ADD COLUMN IF NOT EXISTS topic_category TEXT,
ADD COLUMN IF NOT EXISTS page_references TEXT[],
ADD COLUMN IF NOT EXISTS bloom_level TEXT,
ADD COLUMN IF NOT EXISTS question_type TEXT,
ADD COLUMN IF NOT EXISTS exam_tip TEXT;

-- Create index for efficient filtering by metadata
CREATE INDEX IF NOT EXISTS idx_questions_metadata 
ON questions(difficulty_level, exam_likelihood, topic_category);

-- Add comment explaining the enhancement
COMMENT ON COLUMN questions.difficulty_level IS 'Question difficulty: easy, medium, or hard';
COMMENT ON COLUMN questions.exam_likelihood IS 'Probability of appearing in exam: low, medium, high, or very_high';
COMMENT ON COLUMN questions.topic_category IS 'Topic category for the question';
COMMENT ON COLUMN questions.page_references IS 'Array of page numbers where content is referenced';
COMMENT ON COLUMN questions.bloom_level IS 'Blooms Taxonomy level: remember, understand, apply, analyze, evaluate, create';
COMMENT ON COLUMN questions.question_type IS 'Type of question: recall, application, analysis, or synthesis';
COMMENT ON COLUMN questions.exam_tip IS 'Teacher tip about exam relevance';