import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, BookOpen, Brain, Lightbulb, X, List, Grid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MaterialAnalysis {
  id: string;
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

interface StudyMaterialViewerProps {
  analyses: MaterialAnalysis[];
  open: boolean;
  onClose: () => void;
}

interface TopicGroup {
  topic: string;
  extractedText: string;
  keyConcepts: Set<string>;
  definitions: Record<string, string>;
  formulas: Set<string>;
  pageReferences: number[];
  isFoundational: boolean;
}

export function StudyMaterialViewer({ analyses, open, onClose }: StudyMaterialViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"topics" | "pages">("topics");

  // Group analyses by topic
  const groupAnalysesByTopic = (): TopicGroup[] => {
    const topicMap = new Map<string, TopicGroup>();

    analyses.forEach(analysis => {
      analysis.major_topics.forEach(topic => {
        if (!topicMap.has(topic)) {
          topicMap.set(topic, {
            topic,
            extractedText: "",
            keyConcepts: new Set(),
            definitions: {},
            formulas: new Set(),
            pageReferences: [],
            isFoundational: false,
          });
        }

        const group = topicMap.get(topic)!;
        
        // Merge text with page separator
        if (group.extractedText && analysis.extracted_text) {
          group.extractedText += "\n\n" + analysis.extracted_text;
        } else {
          group.extractedText = analysis.extracted_text;
        }

        // Collect concepts
        analysis.key_concepts.forEach(c => group.keyConcepts.add(c));
        
        // Merge definitions
        Object.assign(group.definitions, analysis.definitions);
        
        // Collect formulas
        analysis.formulas.forEach(f => group.formulas.add(f));
        
        // Add page reference
        if (!group.pageReferences.includes(analysis.page_number)) {
          group.pageReferences.push(analysis.page_number);
        }
        
        // Mark as foundational if any page is foundational
        if (analysis.is_foundational) {
          group.isFoundational = true;
        }
      });
    });

    // Sort: foundational first, then alphabetically
    return Array.from(topicMap.values()).sort((a, b) => {
      if (a.isFoundational && !b.isFoundational) return -1;
      if (!a.isFoundational && b.isFoundational) return 1;
      return a.topic.localeCompare(b.topic);
    });
  };

  const topicGroups = groupAnalysesByTopic();

  // Get all unique topics
  const allTopics = Array.from(
    new Set(analyses.flatMap(a => a.major_topics))
  ).sort();

  // Filter topic groups based on search and selected topics
  const filteredTopicGroups = topicGroups.filter(group => {
    const matchesSearch = searchQuery === "" ||
      group.extractedText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Array.from(group.keyConcepts).some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTopics = selectedTopics.size === 0 || selectedTopics.has(group.topic);

    return matchesSearch && matchesTopics;
  });

  // Filter analyses based on search and topics (for page view)
  const filteredAnalyses = analyses.filter(analysis => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Study Materials
          </DialogTitle>
        </DialogHeader>

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

          {/* View Toggle and Topic Filter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Filter by Topics:</p>
                {(selectedTopics.size > 0 || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 px-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTopics.map(topic => (
                  <Badge
                    key={topic}
                    variant={selectedTopics.has(topic) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                    {selectedTopics.has(topic) && (
                      <span className="ml-1">✓</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "topics" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("topics")}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1" />
                Topics
              </Button>
              <Button
                variant={viewMode === "pages" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("pages")}
                className="h-8 px-3"
              >
                <Grid className="h-4 w-4 mr-1" />
                Pages
              </Button>
            </div>
          </div>

          <Separator />

          {/* Content */}
          <ScrollArea className="h-[500px] pr-4">
            {viewMode === "topics" ? (
              /* Topic View */
              <div className="space-y-6">
                {filteredTopicGroups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No topics found matching your search.</p>
                  </div>
                ) : (
                  filteredTopicGroups.map((group) => (
                    <Card key={group.topic} className="overflow-hidden">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {group.topic}
                          </CardTitle>
                          {group.isFoundational && (
                            <Badge variant="secondary">
                              <Brain className="h-3 w-3 mr-1" />
                              Foundational
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Continuous Text */}
                        <div className="prose prose-sm max-w-none">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {group.extractedText}
                          </p>
                        </div>

                        <Separator />

                        {/* Collapsible Metadata */}
                        {group.keyConcepts.size > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:underline">
                              <Brain className="h-4 w-4" />
                              Key Concepts ({group.keyConcepts.size})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="flex flex-wrap gap-1">
                                {Array.from(group.keyConcepts).map((concept, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {concept}
                                  </Badge>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {Object.keys(group.definitions).length > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:underline">
                              <BookOpen className="h-4 w-4" />
                              Definitions ({Object.keys(group.definitions).length})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="space-y-2">
                                {Object.entries(group.definitions).map(([term, definition]) => (
                                  <div key={term} className="bg-muted/50 p-3 rounded-md">
                                    <p className="font-medium text-sm">{term}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{definition}</p>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {group.formulas.size > 0 && (
                          <Collapsible>
                            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:underline">
                              🔬 Formulas ({group.formulas.size})
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="flex flex-wrap gap-2">
                                {Array.from(group.formulas).map((formula, idx) => (
                                  <code key={idx} className="bg-muted px-2 py-1 rounded text-sm">
                                    {formula}
                                  </code>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Page References */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                          📄 Mentioned on pages: {group.pageReferences.sort((a, b) => a - b).join(", ")}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              /* Page View */
              <div className="space-y-6">
                {filteredAnalyses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No materials found matching your search.</p>
                  </div>
                ) : (
                  filteredAnalyses.map((analysis) => (
                    <Card key={analysis.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            Page {analysis.page_number}
                          </CardTitle>
                          {analysis.is_foundational && (
                            <Badge variant="secondary">
                              <Brain className="h-3 w-3 mr-1" />
                              Foundational
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {analysis.major_topics.map(topic => (
                              <Badge key={topic} variant="outline" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Extracted Text */}
                        <div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {analysis.extracted_text}
                          </p>
                        </div>

                        {/* Key Concepts */}
                        {analysis.key_concepts.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                              <Brain className="h-4 w-4" />
                              Key Concepts
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {analysis.key_concepts.map((concept, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {concept}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Definitions */}
                        {Object.keys(analysis.definitions).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                              <BookOpen className="h-4 w-4" />
                              Definitions
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(analysis.definitions).map(([term, definition]) => (
                                <div key={term} className="bg-muted/50 p-3 rounded-md">
                                  <p className="font-medium text-sm">{term}</p>
                                  <p className="text-sm text-muted-foreground mt-1">{definition}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Formulas */}
                        {analysis.formulas.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">🔬 Formulas</h4>
                            <div className="flex flex-wrap gap-2">
                              {analysis.formulas.map((formula, idx) => (
                                <code key={idx} className="bg-muted px-2 py-1 rounded text-sm">
                                  {formula}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Visual Elements */}
                        {analysis.visual_elements.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">📊 Visual Elements</h4>
                            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                              {analysis.visual_elements.map((element, idx) => (
                                <li key={idx}>{element}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Important Points */}
                        {analysis.emphasis_markers.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                              <Lightbulb className="h-4 w-4" />
                              Important Points
                            </h4>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                              {analysis.emphasis_markers.map((marker, idx) => (
                                <li key={idx} className="font-medium">{marker}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </ScrollArea>

          <div className="text-center text-sm text-muted-foreground">
            {viewMode === "topics" 
              ? `Showing ${filteredTopicGroups.length} topics`
              : `Showing ${filteredAnalyses.length} of ${analyses.length} pages`
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
