import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, BookOpen, Brain, Lightbulb, List, Grid, Filter, Image as ImageIcon, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MaterialViewer } from "@/components/MaterialViewer";

interface MaterialAnalysis {
  id: string;
  material_id: string;
  page_number: number;
  extracted_text: string;
  major_topics: string[];
  key_concepts: string[];
  definitions: Record<string, string>;
  formulas: string[];
  visual_elements: string[];
  emphasis_markers: string[];
  is_foundational: boolean;
}

interface Material {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  material_type: 'content' | 'learning_objectives' | 'reference';
}

interface TopicGroup {
  topic: string;
  extractedText: string;
  keyConcepts: Set<string>;
  definitions: Record<string, string>;
  formulas: Set<string>;
  visualElements: string[];
  materialIds: Set<string>;
  pageReferences: number[];
  isFoundational: boolean;
}

// Cache for signed URLs
const urlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrl(storagePath: string): Promise<string> {
  const cached = urlCache.get(storagePath);
  const now = Date.now();
  
  if (cached && cached.expires > now) {
    return cached.url;
  }
  
  const { data } = await supabase.storage
    .from('study-materials')
    .createSignedUrl(storagePath, 3600);
  
  if (data?.signedUrl) {
    urlCache.set(storagePath, {
      url: data.signedUrl,
      expires: now + (59 * 60 * 1000)
    });
    return data.signedUrl;
  }
  
  throw new Error('Failed to get signed URL');
}

export default function Study() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"topics" | "pages">("topics");
  const [showFilters, setShowFilters] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialUrls, setMaterialUrls] = useState<Map<string, string>>(new Map());
  const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [analyses, setAnalyses] = useState<MaterialAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionTitle, setCollectionTitle] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [speechSynthesis] = useState(() => window.speechSynthesis);

  // Load collection and analyses
  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      
      // Load collection
      const { data: collectionData } = await supabase
        .from('collections')
        .select('title')
        .eq('id', id)
        .single();
      
      if (collectionData) {
        setCollectionTitle(collectionData.title);
      }

      // Load analyses
      const { data: analysesData } = await supabase
        .from('material_analysis')
        .select('*')
        .eq('collection_id', id)
        .order('page_number');

      if (analysesData) {
        setAnalyses(analysesData as any);
      }

      setLoading(false);
    };

    loadData();
  }, [id]);

  // Load materials and their URLs
  useEffect(() => {
    if (analyses.length === 0) return;

    const loadMaterials = async () => {
      const materialIds = [...new Set(analyses.map(a => a.material_id).filter(Boolean))];
      
      if (materialIds.length === 0) return;

      const { data: materialsData } = await supabase
        .from('materials')
        .select('id, storage_path, file_name, mime_type, file_size, material_type')
        .in('id', materialIds);

      if (materialsData) {
        // Filter to content materials only
        const contentMaterials = materialsData.filter(
          m => m.material_type === 'content'
        );
        setMaterials(contentMaterials);

        // Generate signed URLs
        const urlMap = new Map<string, string>();
        for (const material of contentMaterials) {
          try {
            const url = await getSignedUrl(material.storage_path);
            urlMap.set(material.id, url);
          } catch (error) {
            console.error(`Failed to load URL for ${material.file_name}:`, error);
          }
        }
        setMaterialUrls(urlMap);
      }
    };

    loadMaterials();
  }, [analyses]);

  // Group analyses by topic
  const groupAnalysesByTopic = (): TopicGroup[] => {
    const topicMap = new Map<string, TopicGroup>();

    // Filter to only content type materials first
    const contentAnalyses = analyses.filter(analysis => {
      const material = materials.find(m => m.id === analysis.material_id);
      return material && material.material_type === 'content';
    });

    contentAnalyses.forEach(analysis => {
      analysis.major_topics.forEach(topic => {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            topic,
            extractedText: "",
            keyConcepts: new Set(),
            definitions: {},
            formulas: new Set(),
            visualElements: [],
            materialIds: new Set(),
            pageReferences: [],
            isFoundational: false
          });
        }

        const group = topicMap.get(topic)!;
        
        // Concatenate extracted text
        if (analysis.extracted_text) {
          group.extractedText += (group.extractedText ? "\n\n" : "") + analysis.extracted_text;
        }
        
        // Add key concepts
        analysis.key_concepts.forEach(concept => group.keyConcepts.add(concept));
        
        // Merge definitions
        Object.assign(group.definitions, analysis.definitions || {});
        
        // Add formulas
        (analysis.formulas || []).forEach(formula => group.formulas.add(formula));
        
        // Add visual elements
        if (analysis.visual_elements && analysis.visual_elements.length > 0) {
          group.visualElements.push(...analysis.visual_elements);
        }
        
        // Track material and page references
        group.materialIds.add(analysis.material_id);
        if (analysis.page_number) {
          group.pageReferences.push(analysis.page_number);
        }
        
        // Track if foundational
        if (analysis.is_foundational) {
          group.isFoundational = true;
        }
      });
    });

    return Array.from(topicMap.values()).sort((a, b) => {
      if (a.isFoundational && !b.isFoundational) return -1;
      if (!a.isFoundational && b.isFoundational) return 1;
      return a.topic.localeCompare(b.topic);
    });
  };

  const handleOpenMaterial = (materialId: string) => {
    const index = materials.findIndex(m => m.id === materialId);
    if (index !== -1) {
      setSelectedMaterial(index);
      setViewerOpen(true);
    }
  };

  const handleReadAloud = () => {
    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    // Get all visible text content
    const contentToRead = filteredAnalyses
      .map(analysis => analysis.extracted_text)
      .filter(text => text && text.trim().length > 0)
      .join('. ');

    if (!contentToRead) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(contentToRead);
    utterance.lang = 'sv-SE'; // Swedish language
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to find a Swedish voice
    const voices = speechSynthesis.getVoices();
    const swedishVoice = voices.find(voice => 
      voice.lang === 'sv-SE' || voice.lang.startsWith('sv')
    );
    if (swedishVoice) {
      utterance.voice = swedishVoice;
    }
    
    utterance.onend = () => {
      setIsReading(false);
    };
    
    utterance.onerror = () => {
      setIsReading(false);
    };

    speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const handleReadPage = (text: string) => {
    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    if (!text || !text.trim()) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sv-SE';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = speechSynthesis.getVoices();
    const swedishVoice = voices.find(voice => 
      voice.lang === 'sv-SE' || voice.lang.startsWith('sv')
    );
    if (swedishVoice) {
      utterance.voice = swedishVoice;
    }
    
    utterance.onend = () => {
      setIsReading(false);
    };
    
    utterance.onerror = () => {
      setIsReading(false);
    };

    speechSynthesis.speak(utterance);
    setIsReading(true);
  };

  const topicGroups = groupAnalysesByTopic();

  // Get all unique topics from content materials only
  const contentAnalyses = analyses.filter(analysis => {
    const material = materials.find(m => m.id === analysis.material_id);
    return material && material.material_type === 'content';
  });
  
  const allTopics = Array.from(
    new Set(contentAnalyses.flatMap(a => a.major_topics))
  ).sort();

  // Filter topic groups based on search and selected topics
  const filteredTopicGroups = topicGroups.filter(group => {
    const matchesSearch = searchQuery === "" ||
      group.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.extractedText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Array.from(group.keyConcepts).some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTopics = selectedTopics.size === 0 || selectedTopics.has(group.topic);

    return matchesSearch && matchesTopics;
  });

  // Filter analyses based on search and topics (for page view) - content materials only
  const filteredAnalyses = contentAnalyses.filter(analysis => {
    const matchesSearch = searchQuery === "" || 
      analysis.extracted_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      analysis.major_topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      analysis.key_concepts.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTopics = selectedTopics.size === 0 ||
      analysis.major_topics.some(t => selectedTopics.has(t));

    return matchesSearch && matchesTopics;
  });

  const toggleTopic = (topic: string) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topic)) {
      newSelected.delete(topic);
    } else {
      newSelected.add(topic);
    }
    setSelectedTopics(newSelected);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTopics(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading study materials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/collection/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Collection
          </Button>
          
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{collectionTitle}</h1>
              <p className="text-muted-foreground">Study Materials</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content, topics, or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters Button and View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {selectedTopics.size > 0 && (
                  <Badge variant="default" className="ml-2 h-5 px-1.5 text-xs">
                    {selectedTopics.size}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReadAloud}
              >
                {isReading ? (
                  <>
                    <VolumeX className="h-4 w-4 mr-2" />
                    Stop Reading
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Read it for me
                  </>
                )}
              </Button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "topics" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("topics")}
                className="h-8 px-3"
              >
                <Grid className="h-4 w-4 mr-2" />
                Topics
              </Button>
              <Button
                variant={viewMode === "pages" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("pages")}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-2" />
                Pages
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Filter by Topics</CardTitle>
                  {selectedTopics.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear all
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allTopics.map(topic => (
                    <Badge
                      key={topic}
                      variant={selectedTopics.has(topic) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleTopic(topic)}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Area */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            {viewMode === "topics" ? (
              // Topics View
              <div className="space-y-4 pr-4">
                {filteredTopicGroups.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No study materials found matching your search.
                    </CardContent>
                  </Card>
                ) : (
                  filteredTopicGroups.map((group, idx) => (
                    <Collapsible key={idx} defaultOpen={idx < 3}>
                      <Card>
                        <CardHeader>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg flex items-center gap-2">
                                {group.isFoundational && (
                                  <Badge variant="secondary" className="text-xs">
                                    Foundational
                                  </Badge>
                                )}
                                {group.topic}
                              </CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {group.pageReferences.length} {group.pageReferences.length === 1 ? 'page' : 'pages'}
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                        </CardHeader>
                        
                        <CollapsibleContent>
                          <CardContent className="space-y-4">
                            {/* Visual Elements with Thumbnails */}
                            {group.visualElements.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  Visual Elements
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Array.from(group.materialIds).map(materialId => {
                                    const material = materials.find(m => m.id === materialId);
                                    const imageUrl = materialUrls.get(materialId);
                                    
                                    if (!material || !imageUrl) return null;

                                    // Get visual elements for this material
                                    const materialAnalyses = analyses.filter(
                                      a => a.material_id === materialId && 
                                      a.major_topics.includes(group.topic)
                                    );
                                    const visualTexts = materialAnalyses.flatMap(a => a.visual_elements);

                                    return (
                                      <div key={materialId} className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg">
                                        <div 
                                          className="w-full flex justify-center cursor-pointer"
                                          onClick={() => handleOpenMaterial(materialId)}
                                        >
                                          <img 
                                            src={imageUrl} 
                                            alt={material.file_name}
                                            className="max-w-xs rounded-md border hover:ring-2 hover:ring-primary transition-all"
                                          />
                                        </div>
                                        <div className="w-full">
                                          <p className="text-xs text-muted-foreground mb-2">
                                            {material.file_name}
                                          </p>
                                          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                            {visualTexts.map((element, idx) => (
                                              <li key={idx} className="line-clamp-2">{element}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Main Content */}
                            {group.extractedText && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Content</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {group.extractedText}
                                </p>
                              </div>
                            )}

                            <Separator />

                            {/* Key Concepts */}
                            {group.keyConcepts.size > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                  <Brain className="h-4 w-4" />
                                  Key Concepts
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from(group.keyConcepts).map((concept, i) => (
                                    <Badge key={i} variant="secondary">
                                      {concept}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Definitions */}
                            {Object.keys(group.definitions).length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                  <Lightbulb className="h-4 w-4" />
                                  Definitions
                                </h4>
                                <div className="space-y-2">
                                  {Object.entries(group.definitions).map(([term, def], i) => (
                                    <div key={i} className="text-sm">
                                      <span className="font-medium">{term}:</span>{" "}
                                      <span className="text-muted-foreground">{def}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Formulas */}
                            {group.formulas.size > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Formulas</h4>
                                <div className="space-y-1">
                                  {Array.from(group.formulas).map((formula, i) => (
                                    <code key={i} className="block text-sm bg-muted p-2 rounded">
                                      {formula}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))
                )}
              </div>
            ) : (
              // Pages View
              <div className="space-y-4 pr-4">
                {filteredAnalyses.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No pages found matching your search.
                    </CardContent>
                  </Card>
                ) : (
                  filteredAnalyses.map((analysis) => {
                    const material = materials.find(m => m.id === analysis.material_id);
                    const imageUrl = material ? materialUrls.get(material.id) : null;
                    
                    return (
                      <Card key={analysis.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">
                                Page {analysis.page_number}
                                {material && (
                                  <span className="text-sm text-muted-foreground ml-2">
                                    • {material.file_name}
                                  </span>
                                )}
                              </CardTitle>
                              <CardDescription>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {analysis.major_topics.map((topic, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReadPage(analysis.extracted_text)}
                            >
                              {isReading ? (
                                <VolumeX className="h-4 w-4" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Visual Elements with Thumbnail */}
                          {analysis.visual_elements.length > 0 && material && imageUrl && (
                            <div className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                              <div 
                                className="flex-shrink-0 cursor-pointer"
                                onClick={() => handleOpenMaterial(material.id)}
                              >
                                <img 
                                  src={imageUrl} 
                                  alt={material.file_name}
                                  className="w-32 h-32 object-cover rounded-md border hover:ring-2 hover:ring-primary transition-all"
                                />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  Visual Elements
                                </h4>
                                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                                  {analysis.visual_elements.map((element, idx) => (
                                    <li key={idx}>{element}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {analysis.extracted_text}
                          </p>

                          {analysis.key_concepts.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Key Concepts</h4>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.key_concepts.map((concept, i) => (
                                    <Badge key={i} variant="secondary">
                                      {concept}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Material Viewer Modal */}
        <MaterialViewer 
          materials={materials}
          analyses={analyses}
          initialIndex={selectedMaterial || 0}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onTypeChange={async () => {
            // Reload materials after type change
            if (!id) return;
            const { data: analysesData } = await supabase
              .from('material_analysis')
              .select('*')
              .eq('collection_id', id)
              .order('page_number');
            if (analysesData) {
              setAnalyses(analysesData as any);
            }
          }}
        />
      </div>
    </div>
  );
}
