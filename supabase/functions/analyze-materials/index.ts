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
    console.log('Starting material analysis for collection:', collectionId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch collection and materials
    const { data: collection, error: collectionError } = await supabaseClient
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single();

    if (collectionError || !collection) {
      console.error('Collection not found:', collectionError);
      return new Response(
        JSON.stringify({ error: 'Collection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: materials, error: materialsError } = await supabaseClient
      .from('materials')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at');

    if (materialsError || !materials?.length) {
      console.error('No materials found:', materialsError);
      return new Response(
        JSON.stringify({ error: 'No materials found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${materials.length} materials to analyze`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResults = [];
    let pageNumber = 1;

    for (const material of materials) {
      console.log(`Analyzing material: ${material.file_name}`);

      // Generate signed URL for the material
      const { data: signedUrlData, error: urlError } = await supabaseClient
        .storage
        .from('study-materials')
        .createSignedUrl(material.storage_path, 3600);

      if (urlError || !signedUrlData?.signedUrl) {
        console.error(`Failed to generate signed URL for ${material.file_name}:`, urlError);
        continue;
      }

      // Determine material type for customized analysis
      const materialType = material.material_type || 'content';
      
      let analysisPrompt = '';
      
      if (materialType === 'learning_objectives') {
        analysisPrompt = `You are an expert educational content analyzer. This is a LEARNING OBJECTIVES or STUDY PLAN document.

TASK: Extract the learning goals, objectives, and requirements that students need to achieve.

LEARNING OBJECTIVES: List all learning goals, competencies, and skills mentioned
TOPIC AREAS: Identify the main subject areas or topics covered
KEY CONCEPTS: Extract specific concepts or knowledge areas students must learn

Return valid JSON:
{
  "learning_objectives": ["objective1", "objective2"],
  "major_topics": ["topic1", "topic2"],
  "key_concepts": ["concept1", "concept2"],
  "extracted_text": "brief summary of the objectives",
  "is_foundational": false
}`;
      } else {
        analysisPrompt = `You are an expert educational content analyzer. Analyze this study material and extract ALL information.

IMPORTANT: Analyze from a STUDENT PERSPECTIVE. Focus on what students need to LEARN.

TEXT EXTRACTION: Extract all text and reflow it into natural paragraphs. Remove artificial line breaks within sentences. Only keep paragraph breaks between distinct topics/sections. The output should read as flowing prose, not fragmented lines.

TOPIC IDENTIFICATION: 
- Identify 1-3 major topics (broad themes)
- List 3-8 key concepts (specific ideas students must learn)
- Mark if FOUNDATIONAL (basic) or ADVANCED

DEFINITIONS: Extract terms with explanations as JSON:
{"Term": "Definition"}

FORMULAS: List mathematical/scientific formulas

VISUAL ELEMENTS: Only note the TYPE of visual (e.g., "Image: Map", "Diagram: Process flow", "Chart: Statistics"). Do NOT describe content in detail.

EMPHASIS: Note highlighted, bold, or emphasized content

Return valid JSON:
{
  "extracted_text": "flowing text with natural paragraphs",
  "major_topics": ["topic1", "topic2"],
  "key_concepts": ["concept1", "concept2"],
  "definitions": {"Term": "Definition"},
  "formulas": ["formula1"],
  "visual_elements": ["description"],
  "emphasis_markers": ["important point"],
  "is_foundational": true
}`;
      }

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: analysisPrompt },
                  { type: 'image_url', image_url: { url: signedUrlData.signedUrl } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          }),
        });

        if (aiResponse.status === 429) {
          console.error('Rate limit exceeded');
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (aiResponse.status === 402) {
          console.error('Payment required');
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          continue;
        }

        let analysis;
        try {
          analysis = JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
          continue;
        }

        // Normalize text by removing excessive line breaks
        const normalizeText = (text: string): string => {
          if (!text) return '';
          return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join(' ')
            .replace(/\s+/g, ' ')
            .replace(/([.!?])\s+/g, '$1\n\n')
            .trim();
        };

        // Store analysis in database
        const { error: insertError } = await supabaseClient
          .from('material_analysis')
          .upsert({
            material_id: material.id,
            collection_id: collectionId,
            extracted_text: normalizeText(analysis.extracted_text || ''),
            major_topics: analysis.major_topics || [],
            key_concepts: analysis.key_concepts || [],
            definitions: analysis.definitions || {},
            formulas: analysis.formulas || [],
            visual_elements: analysis.visual_elements || [],
            emphasis_markers: analysis.emphasis_markers || [],
            is_foundational: analysis.is_foundational || false,
            learning_objectives: analysis.learning_objectives || [],
            page_number: pageNumber,
            token_count: Math.round((analysis.extracted_text?.length || 0) / 4),
            analyzed_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Failed to store analysis:', insertError);
        } else {
          console.log(`Successfully analyzed: ${material.file_name}`);
          analysisResults.push({
            material_id: material.id,
            file_name: material.file_name,
            page_number: pageNumber,
            topics: analysis.major_topics
          });
        }

        pageNumber++;

      } catch (error) {
        console.error(`Error analyzing ${material.file_name}:`, error);
      }
    }

    console.log(`Analysis complete. Processed ${analysisResults.length} materials`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_count: analysisResults.length,
        total_materials: materials.length,
        results: analysisResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-materials function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
