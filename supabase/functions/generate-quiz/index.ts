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

    // Fetch materials with their types and analyses
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('id, material_type, file_name')
      .eq('collection_id', collectionId);

    if (materialsError) {
      console.error('Error fetching materials:', materialsError);
      throw new Error('Failed to fetch materials');
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

    // Map material types to analyses
    const materialTypeMap = new Map(materials?.map(m => [m.id, m.material_type]) || []);
    const enrichedAnalyses = analyses.map(a => ({
      ...a,
      material_type: materialTypeMap.get(a.material_id) || 'content'
    }));

    // Categorize analyses by type
    const learningObjectives = enrichedAnalyses.filter(a => a.material_type === 'learning_objectives');
    const contentMaterials = enrichedAnalyses.filter(a => a.material_type === 'content');
    const referenceMaterials = enrichedAnalyses.filter(a => a.material_type === 'reference');

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

    // Call Lovable AI with Gemini to analyze and generate quiz with teacher reasoning
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a veteran teacher with 20+ years of experience who deeply understands how students learn and where they struggle. You don't just create questions — you THINK like a teacher preparing students for an exam.

## YOUR TEACHING PHILOSOPHY
Before generating any questions, you must REASON through the material like a teacher would:
1. **Identify the core concepts** — What are the 3-5 things a student MUST understand to pass?
2. **Anticipate misconceptions** — Where do students ALWAYS get confused? What do they mix up?
3. **Build scaffolding** — Start with foundation questions, then build to harder ones that require combining concepts
4. **Test understanding, not memory** — A student who memorized the textbook should NOT automatically ace your quiz. Rephrase, apply to new contexts, ask "why" not just "what"

## MATERIAL HIERARCHY (STRICT)
1. 🎯 **LEARNING GOALS** (learning_objectives) → PRIMARY FOCUS
   - Every learning goal MUST have at least one question
   - These define what students are EXPECTED to demonstrate
   
2. 📚 **STUDY MATERIALS** (content) → QUESTION SOURCE
   - Cross-reference with learning goals for alignment
   - Use specific details, examples, and formulas from here
   
3. 📌 **REFERENCE MATERIALS** (reference) → CONTEXT ONLY
   - Background knowledge, NOT directly assessed

## LANGUAGE RULE (CRITICAL)
- Detect the language of the study materials
- Generate ALL content in that SAME language (title, questions, answers, explanations, tips)
- Never translate — match the original language exactly

## QUIZ VARIATION
${quizCount > 0 ? `⚠️ This collection has ${quizCount} existing quiz(zes). You MUST:
- Create COMPLETELY DIFFERENT questions — different angles, scenarios, and wording
- If previous quizzes tested definitions, now test APPLICATION
- If previous quizzes asked "what", now ask "why" or "what happens if..."
- Explore sub-topics or edge cases not yet covered` : '✨ First quiz — build a solid foundation across all major topics'}

## QUIZ TITLE
${quizCount === 0 ? 'First quiz: "Grunderna i [Ämne]", "Introduction to [Topic]"' : 
  quizCount === 1 ? 'Second quiz: "Fördjupning: [Ämne]", "[Topic] - Del 2"' :
  quizCount === 2 ? 'Third quiz: "[Ämne] - Utmaningen", "Advanced [Topic]"' :
  `Quiz #${quizCount + 1}: Creative name focusing on specific sub-topics`}
Keep titles SHORT (3-6 words), in the SAME language as materials.

## QUESTION DESIGN (THE TEACHER'S CRAFT)

### Quantity
- 1 question per 1.5-2 pages of content (e.g., 19 pages → 12-15 questions)
- Minimum 10, maximum 20 questions

### Cognitive Distribution (Bloom's Taxonomy)
- ~20% **Remember** — Key terms, definitions, basic facts. But rephrase from the textbook!
- ~30% **Understand/Apply** — "Given this scenario, which method would you use?" "What happens when X changes?"
- ~25% **Analyze** — Compare concepts, explain cause-effect, identify relationships
- ~25% **Evaluate/Create** — These are the HIGHEST GRADE questions. Students must demonstrate reasoning, argumentation, and the ability to weigh multiple perspectives. Ask "why", "compare and discuss", "what would happen if", "evaluate which approach is better and justify". These questions separate students who memorized from those who truly understand.

### GRADING AWARENESS
- Students aiming for the highest grade must show "developed and well-supported reasoning" (utvecklade och väl underbyggda resonemang)
- Include questions where ALL answers seem partially correct, but only one demonstrates DEEP understanding
- At least 2-3 questions should require combining knowledge from multiple topics

### Progressive Difficulty
- Questions 1-3: Warm up (easy, builds confidence)
- Questions 4-8: Core understanding (medium, tests real comprehension)  
- Questions 9-12: Challenge (medium-hard, requires combining concepts)
- Questions 13+: Deep thinking (hard, edge cases, synthesis)

### WRONG ANSWERS — THE MOST IMPORTANT PART
A teacher's skill shows in the WRONG answers. Each wrong answer must be:
- **Based on a real misconception** — What do students ACTUALLY confuse this with?
- **Plausible at first glance** — A student who didn't study should be tempted
- **Diagnostically useful** — If a student picks this wrong answer, you know exactly WHAT they misunderstood

Wrong answer strategies:
- **Partial truth**: Correct concept but wrong detail
- **Common confusion**: Two similar concepts swapped (e.g., mitosis vs meiosis)
- **Off-by-one errors**: Correct process but wrong step order
- **Overgeneralization**: Rule that works sometimes but not here
- **Surface-level answer**: Looks right but misses deeper understanding

### EXPLANATIONS — TEACH, DON'T JUST CORRECT
Each explanation should:
- State WHY the correct answer is right (not just "because it is")
- Address WHY the most tempting wrong answer is wrong
- Connect to the broader concept
- Give a memorable tip or analogy when possible

### EXAM INTELLIGENCE
- **very_high**: Concepts repeated across multiple pages, highlighted, or in learning objectives
- **high**: Foundational building blocks, definitions in boxes, formulas
- **medium**: Supporting details, examples
- **low**: Nice-to-know, edge cases

## OUTPUT FORMAT (JSON)
{
  "title": "Short quiz title (3-6 words, material language)",
  "description": "Brief overview of what this quiz tests",
  "teaching_reasoning": "Brief note on your pedagogical approach for this quiz — what misconceptions you're targeting, what skills you're testing",
  "content_analysis": {
    "major_topics": ["Topic 1", "Topic 2"],
    "total_pages_analyzed": number,
    "recommended_question_count": number,
    "identified_misconceptions": ["Common mistake 1", "Common mistake 2"]
  },
  "questions": [
    {
      "question": "Clear, specific question that tests understanding?",
      "correct_answer": "The correct answer",
      "wrong_answers": ["Misconception-based wrong 1", "Misconception-based wrong 2", "Misconception-based wrong 3"],
      "explanation": "Teaching explanation: why correct, why tempting wrong answer fails, connection to bigger picture",
      "difficulty": "easy|medium|hard",
      "bloom_level": "remember|understand|apply|analyze|evaluate|create",
      "question_type": "recall|application|analysis|synthesis",
      "topic_category": "Main topic",
      "exam_likelihood": "low|medium|high|very_high",
      "exam_tip": "Why this matters for the exam + study advice",
      "page_references": ["Page X"],
      "misconception_targeted": "The specific student mistake this question catches"
    }
  ]
}`
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

${learningObjectives.length > 0 ? `
🎯 LEARNING GOALS - YOUR PRIMARY FOCUS (${learningObjectives.length} items):
These define what students MUST achieve. Create questions that TEST these objectives:

${learningObjectives.map((analysis, idx) => `
Learning Goal ${idx + 1}:
${analysis.learning_objectives?.length > 0 ? `Objectives:\n${analysis.learning_objectives.map((lo: string) => `• ${lo}`).join('\n')}\n` : ''}
Key Concepts to Test: ${analysis.key_concepts.join(', ')}
${analysis.extracted_text.substring(0, 600)}${analysis.extracted_text.length > 600 ? '...' : ''}
`).join('\n\n')}
` : ''}

${contentMaterials.length > 0 ? `
📚 STUDY MATERIALS - GENERATE QUESTIONS FROM THIS (${contentMaterials.length} pages):
Use this content to create specific questions aligned with the learning goals above:

${contentMaterials.map((analysis, idx) => `
─── Page ${analysis.page_number || idx + 1} ───
Topics: ${analysis.major_topics.join(', ')}
Key Concepts: ${analysis.key_concepts.join(', ')}

Content:
${analysis.extracted_text.substring(0, 800)}${analysis.extracted_text.length > 800 ? '...' : ''}

${Object.keys(analysis.definitions || {}).length > 0 ? `Definitions: ${JSON.stringify(analysis.definitions)}` : ''}
${analysis.formulas?.length > 0 ? `Formulas: ${analysis.formulas.join(', ')}` : ''}
${analysis.emphasis_markers?.length > 0 ? `Important: ${analysis.emphasis_markers.join('; ')}` : ''}
${analysis.visual_elements?.length > 0 ? `Visuals: ${analysis.visual_elements.join('; ')}` : ''}
`).join('\n\n')}
` : ''}

${referenceMaterials.length > 0 ? `
📌 REFERENCE MATERIALS - CONTEXT ONLY (${referenceMaterials.length} pages):
Use as background knowledge but DO NOT generate direct questions from these:

${referenceMaterials.map((analysis, idx) => `
Reference ${idx + 1}: ${analysis.major_topics.join(', ')}
${analysis.extracted_text.substring(0, 400)}...
`).join('\n\n')}
` : ''}

${learningObjectives.length === 0 ? `
⚠️ Note: No specific learning goals were defined. Generate questions covering all major topics from the study materials.
` : `
✅ QUIZ STRATEGY:
1. Start with learning goals - ensure each one is tested
2. Use study materials to create detailed, specific questions
3. Reference materials provide context but are not directly assessed
4. ${quizCount > 0 ? 'Create DIFFERENT questions than previous quizzes' : 'Create comprehensive coverage'}
`}

Create a comprehensive quiz with proper distribution across Bloom's taxonomy levels. ${quizCount > 0 ? 'Remember: VARY from existing questions!' : ''}`
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