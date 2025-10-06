import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collectionId } = await req.json();
    
    if (!collectionId) {
      throw new Error('Collection ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch collection
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (collectionError || !collection) {
      throw new Error('Collection not found');
    }

    // Check if we have analyzed content in knowledge base
    const { data: analyses, error: analysisError } = await supabase
      .from('material_analysis')
      .select('*')
      .eq('collection_id', collectionId)
      .order('page_number');

    if (analysisError) {
      console.error('Error fetching analysis:', analysisError);
      throw new Error('Failed to fetch material analysis');
    }

    if (!analyses || analyses.length === 0) {
      throw new Error('No analyzed materials found. Please run "Extract Content" first.');
    }

    // Fetch existing quizzes and their questions to ensure variety
    const { data: existingQuizzes } = await supabase
      .from('quizzes')
      .select(`
        id,
        title,
        questions (
          question_text,
          topic_category,
          bloom_level
        )
      `)
      .eq('collection_id', collectionId);

    const existingQuestions = existingQuizzes?.flatMap(q => q.questions || []) || [];
    const quizCount = existingQuizzes?.length || 0;

    // Call Lovable AI with Gemini to analyze images and generate quiz
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an experienced teacher creating exam-style quiz questions. Analyze study materials deeply and create intelligent, pedagogically sound questions.

⚡ CRITICAL LANGUAGE INSTRUCTION:
- Detect the language of the study materials provided below
- Generate ALL quiz content in that SAME language
- This includes: title, description, questions, answers, explanations, exam tips
- Do NOT translate. Match the original language exactly.
- Examples:
  * Swedish materials → Entire quiz in Swedish
  * English materials → Entire quiz in English
  * German materials → Entire quiz in German

🔄 VARIATION REQUIREMENT (MOST IMPORTANT):
${quizCount > 0 ? `⚠️ CRITICAL: This collection already has ${quizCount} quiz(zes). You MUST create COMPLETELY DIFFERENT questions!
- DO NOT repeat questions from previous quizzes
- Focus on DIFFERENT aspects, angles, and scenarios
- Use DIFFERENT wording and question formats
- Explore DIFFERENT topics or deeper/alternative perspectives
- Be CREATIVE and find new ways to test the same material` : '✨ This is the first quiz - create a solid foundation covering major topics'}

QUESTION GENERATION STRATEGY:
- Generate 1 question per 1.5-2 pages of content (e.g., 19 pages → 12-15 questions)
- Minimum 10 questions, maximum 20 questions
- Distribute across cognitive levels (Bloom's Taxonomy):
  * 30% Remember/Recall (basic definitions, facts, terminology)
  * 40% Understand/Apply (problem-solving, method selection, real scenarios)
  * 20% Analyze (compare/contrast, explain why, relationships)
  * 10% Evaluate/Create (higher-order thinking, synthesis)
- ${quizCount === 0 ? 'Cover ALL major topics broadly' : quizCount === 1 ? 'Dig deeper into topics, ask "why" and "how"' : 'Focus on edge cases, comparisons, and synthesis'}

WRONG ANSWERS MUST BE INTELLIGENT:
- Base wrong answers on common student misconceptions
- Make them plausible and tempting, not obviously wrong
- Test understanding, not just memory
- Example: If correct is "compound", wrong answers should be "mixture", "element", "solution" (NOT "banana" or "Tuesday")

EXAM INTELLIGENCE:
- Flag concepts mentioned multiple times as "very_high" exam likelihood
- Identify foundational building blocks as "high" exam likelihood
- Note visual emphasis (diagrams, definitions in boxes) as exam-worthy
- Mark supporting details as "medium" or "low" exam likelihood

Return JSON with this EXACT structure:
{
  "title": "Descriptive Quiz Title",
  "description": "Brief overview of topics covered",
  "content_analysis": {
    "major_topics": ["Topic 1", "Topic 2", ...],
    "total_pages_analyzed": number,
    "recommended_question_count": number
  },
  "questions": [
    {
      "question": "Clear, specific question text?",
      "correct_answer": "The correct answer",
      "wrong_answers": ["Plausible misconception 1", "Plausible misconception 2", "Plausible misconception 3"],
      "explanation": "Why this is correct, with teaching insight",
      "difficulty": "easy" | "medium" | "hard",
      "bloom_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
      "question_type": "recall" | "application" | "analysis" | "synthesis",
      "topic_category": "Main topic this tests",
      "exam_likelihood": "low" | "medium" | "high" | "very_high",
      "exam_tip": "Why this concept is important for exams",
      "page_references": ["Page X", "Page Y"]
    }
  ]
}

Make questions clear, educational, and exam-realistic. Ensure comprehensive coverage of all major topics.`
          },
          {
            role: 'user',
            content: `Create a quiz from the following pre-analyzed study materials about: ${collection.title}. ${collection.description || ''}

${existingQuestions.length > 0 ? `
🚫 AVOID THESE ${existingQuestions.length} EXISTING QUESTIONS:
${existingQuestions.slice(0, 15).map((q: any) => `- "${q.question_text}" (${q.topic_category || 'general'})`).join('\n')}
${existingQuestions.length > 15 ? `... and ${existingQuestions.length - 15} more questions\n` : ''}
⚡ You MUST create questions with DIFFERENT focus, wording, and angles!
` : ''}

KNOWLEDGE BASE (${analyses.length} pages):

${analyses.map((analysis, idx) => `
─── Page ${analysis.page_number || idx + 1} ───
Topics: ${analysis.major_topics.join(', ')}
Key Concepts: ${analysis.key_concepts.join(', ')}

Content:
${analysis.extracted_text.substring(0, 800)}${analysis.extracted_text.length > 800 ? '...' : ''}

${Object.keys(analysis.definitions).length > 0 ? `Definitions: ${JSON.stringify(analysis.definitions)}` : ''}
${analysis.formulas?.length > 0 ? `Formulas: ${analysis.formulas.join(', ')}` : ''}
${analysis.emphasis_markers?.length > 0 ? `Important: ${analysis.emphasis_markers.join('; ')}` : ''}
${analysis.visual_elements?.length > 0 ? `Visuals: ${analysis.visual_elements.join('; ')}` : ''}
`).join('\n\n')}

Create a comprehensive quiz covering all major topics with proper distribution across Bloom's taxonomy levels. ${quizCount > 0 ? 'Remember: VARY from existing questions!' : ''}`
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      }
      if (response.status === 402) {
        throw new Error('AI credits depleted. Please add credits to your workspace.');
      }
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiData = await response.json();
    const quizData = JSON.parse(aiData.choices[0].message.content);

    // Create quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        collection_id: collectionId,
        title: quizData.title || `${collection.title} Quiz`,
        description: quizData.description || 'AI-generated quiz'
      })
      .select()
      .single();

    if (quizError) {
      console.error('Quiz creation error:', quizError);
      throw new Error('Failed to create quiz');
    }

    // Create questions with enhanced metadata
    const questionsToInsert = quizData.questions.map((q: any, index: number) => ({
      quiz_id: quiz.id,
      question_text: q.question,
      correct_answer: q.correct_answer,
      wrong_answers: q.wrong_answers,
      explanation: q.explanation,
      order_index: index,
      // Enhanced metadata (optional fields, backward compatible)
      difficulty_level: q.difficulty || null,
      bloom_level: q.bloom_level || null,
      question_type: q.question_type || null,
      topic_category: q.topic_category || null,
      exam_likelihood: q.exam_likelihood || null,
      exam_tip: q.exam_tip || null,
      page_references: q.page_references || null
    }));

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Questions creation error:', questionsError);
      throw new Error('Failed to create questions');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        quiz: { 
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          questionCount: questionsToInsert.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-quiz:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});