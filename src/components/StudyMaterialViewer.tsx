import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, BookOpen, Brain, Lightbulb, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export function StudyMaterialViewer({ analyses, open, onClose }: StudyMaterialViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  // Get all unique topics
  const allTopics = Array.from(
    new Set(analyses.flatMap(a => a.major_topics))
  ).sort();

  // Filter analyses based on search and topics
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

          {/* Topic Filter */}
          <div>
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

          <Separator />

          {/* Content */}
          <ScrollArea className="h-[500px] pr-4">
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
          </ScrollArea>

          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredAnalyses.length} of {analyses.length} pages
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
