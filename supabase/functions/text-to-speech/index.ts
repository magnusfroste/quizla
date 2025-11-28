import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "Aria" } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Voice ID mapping for ElevenLabs voices
    const voiceIds: Record<string, string> = {
      "Aria": "9BWtsMINqrJLrRacOk9x",
      "Roger": "CwhRBWXzGAHq8TQ4Fs17",
      "Sarah": "EXAVITQu4vr4xnSDxMaL",
      "Laura": "FGY2WhTYpPnrIDTdsKH5",
      "Charlie": "IKne3meq5aSn9XLyUdCD",
      "George": "JBFqnCBsd6RMkjVDRZzb",
      "Callum": "N2lVS1w4EtoT3dr4eOWO",
      "River": "SAz9YHcvj6GT2YYXdXww",
      "Liam": "TX3LPaxmHKxFdv7VOQHJ",
      "Charlotte": "XB0fDUnXU5powFXDhCwa",
      "Alice": "Xb7hH8MSUJpSbSDYk0k2",
      "Matilda": "XrExE9yKIg1WjnnlVkGX",
      "Will": "bIHbv24MWmeRgasZH58o",
      "Jessica": "cgSgspJ2msm6clMCkdW9",
      "Eric": "cjVigY5qzO86Huf0OWal",
      "Chris": "iP95p4xoKVk53GoZ742B",
      "Brian": "nPczCjzI2devNBz1zQrb",
      "Daniel": "onwK4e9ZLuTAKqWW03F9",
      "Lily": "pFZP5JQG7iQjIQuC4Bku",
      "Bill": "pqHfZKP75CvOlQylNhV4",
    };

    const voiceId = voiceIds[voice] || voiceIds["Aria"];

    console.log(`Generating speech for text (${text.length} chars) with voice: ${voice}`);

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000), // ElevenLabs has text limits
          model_id: "eleven_multilingual_v2", // Best for multiple languages including Swedish
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid ElevenLabs API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate speech" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get audio as array buffer and convert to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log("Speech generated successfully, audio size:", audioBuffer.byteLength);

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("text-to-speech error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
