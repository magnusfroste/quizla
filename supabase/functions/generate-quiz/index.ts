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

    // Fetch collection and materials
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('*, materials(*)')
      .eq('id', collectionId)
      .single();

    if (collectionError || !collection) {
      throw new Error('Collection not found');
    }

    if (!collection.materials || collection.materials.length === 0) {
      throw new Error('No materials found in collection');
    }

    // Get signed URLs for images (bucket is private)
    const imageUrls = await Promise.all(
      collection.materials.map(async (material: any) => {
        const { data, error } = await supabase.storage
          .from('study-materials')
          .createSignedUrl(material.storage_path, 3600);
        if (error) {
          console.error('Error creating signed URL:', error);
          throw new Error(`Failed to access material: ${material.file_name}`);
        }
        return data.signedUrl;
      })
    );

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
            content: `You are a quiz generator. Analyze study materials and create engaging multiple-choice questions.
            
Return a JSON object with this exact structure:
{
  "title": "Quiz Title",
  "description": "Brief description",
  "questions": [
    {
      "question": "Question text?",
      "correct_answer": "Correct answer",
      "wrong_answers": ["Wrong 1", "Wrong 2", "Wrong 3"],
      "explanation": "Why this is correct"
    }
  ]
}

Create 5-10 questions of varying difficulty. Make questions clear and educational.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Create a quiz from these study materials about: ${collection.title}. ${collection.description || ''}`
              },
              ...imageUrls.map((url: string) => ({
                type: 'image_url',
                image_url: { url }
              }))
            ]
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

    // Create questions
    const questionsToInsert = quizData.questions.map((q: any, index: number) => ({
      quiz_id: quiz.id,
      question_text: q.question,
      correct_answer: q.correct_answer,
      wrong_answers: q.wrong_answers,
      explanation: q.explanation,
      order_index: index
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