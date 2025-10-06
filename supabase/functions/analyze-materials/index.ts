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

      const analysisPrompt = `You are an expert content extractor analyzing study materials. Extract ALL information from this image in structured format.

EXTRACTION TASKS:
1. FULL TEXT EXTRACTION: Extract every word, sentence, and paragraph exactly as written
2. TOPIC IDENTIFICATION: Identify the 2-3 main topics or subjects covered
3. KEY CONCEPTS: List all important concepts, terms, and ideas mentioned
4. DEFINITIONS: Extract any definitions found (term → definition pairs)
5. FORMULAS/EQUATIONS: List all mathematical, chemical, or scientific formulas
6. VISUAL ELEMENTS: Describe any diagrams, charts, tables, or illustrations
7. EMPHASIS DETECTION: Note any bold text, underlined text, boxed content, or highlighted areas
8. FOUNDATIONAL CHECK: Determine if this is foundational/introductory content

Return your analysis as valid JSON with this exact structure:
{
  "extracted_text": "Complete verbatim text from the image",
  "major_topics": ["Topic 1", "Topic 2"],
  "key_concepts": ["Concept A", "Concept B", "Concept C"],
  "definitions": {
    "Term 1": "Definition 1",
    "Term 2": "Definition 2"
  },
  "formulas": ["Formula 1", "Formula 2"],
  "visual_elements": ["Description of visual 1", "Description of visual 2"],
  "emphasis_markers": ["Important point 1", "Key concept 2"],
  "is_foundational": true
}`;

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

        // Store analysis in database
        const { error: insertError } = await supabaseClient
          .from('material_analysis')
          .upsert({
            material_id: material.id,
            collection_id: collectionId,
            extracted_text: analysis.extracted_text || '',
            major_topics: analysis.major_topics || [],
            key_concepts: analysis.key_concepts || [],
            definitions: analysis.definitions || {},
            formulas: analysis.formulas || [],
            visual_elements: analysis.visual_elements || [],
            emphasis_markers: analysis.emphasis_markers || [],
            is_foundational: analysis.is_foundational || false,
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
