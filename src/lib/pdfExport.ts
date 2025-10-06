import jsPDF from 'jspdf';

interface MaterialAnalysis {
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

export async function generateStudyMaterialPDF(
  analyses: MaterialAnalysis[],
  collectionTitle: string,
  collectionDescription?: string
) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPos = margin;

  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }
  };

  // Cover page
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text(collectionTitle, pageWidth / 2, 80, { align: 'center' });
  
  if (collectionDescription) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const descLines = pdf.splitTextToSize(collectionDescription, maxWidth);
    pdf.text(descLines, pageWidth / 2, 100, { align: 'center' });
  }

  pdf.setFontSize(10);
  pdf.setTextColor(128);
  pdf.text('Study Materials', pageWidth / 2, pageHeight - 40, { align: 'center' });
  pdf.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight - 30, { align: 'center' });

  // Table of contents
  pdf.addPage();
  yPos = margin;
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0);
  pdf.text('Table of Contents', margin, yPos);
  yPos += 15;

  const allTopics = Array.from(new Set(analyses.flatMap(a => a.major_topics)));
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  
  allTopics.forEach(topic => {
    addNewPageIfNeeded(8);
    pdf.text(`• ${topic}`, margin + 5, yPos);
    yPos += 8;
  });

  // Content pages
  analyses.forEach((analysis, idx) => {
    pdf.addPage();
    yPos = margin;

    // Page header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Page ${analysis.page_number}`, margin, yPos);
    yPos += 10;

    // Topics
    if (analysis.major_topics.length > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100);
      pdf.text(analysis.major_topics.join(', '), margin, yPos);
      yPos += 8;
    }

    if (analysis.is_foundational) {
      pdf.setFontSize(9);
      pdf.setTextColor(0, 100, 200);
      pdf.text('⭐ Foundational Content', margin, yPos);
      yPos += 8;
    }

    pdf.setTextColor(0);
    yPos += 5;

    // Main content
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const textLines = pdf.splitTextToSize(analysis.extracted_text, maxWidth);
    
    textLines.forEach((line: string) => {
      addNewPageIfNeeded(6);
      pdf.text(line, margin, yPos);
      yPos += 6;
    });

    yPos += 5;

    // Key concepts
    if (analysis.key_concepts.length > 0) {
      addNewPageIfNeeded(15);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Concepts:', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      analysis.key_concepts.forEach(concept => {
        addNewPageIfNeeded(6);
        pdf.text(`• ${concept}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Definitions
    if (Object.keys(analysis.definitions).length > 0) {
      addNewPageIfNeeded(15);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Definitions:', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      Object.entries(analysis.definitions).forEach(([term, definition]) => {
        addNewPageIfNeeded(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(term, margin + 5, yPos);
        yPos += 5;
        
        pdf.setFont('helvetica', 'normal');
        const defLines = pdf.splitTextToSize(definition, maxWidth - 10);
        defLines.forEach((line: string) => {
          addNewPageIfNeeded(5);
          pdf.text(line, margin + 10, yPos);
          yPos += 5;
        });
        yPos += 3;
      });
      yPos += 5;
    }

    // Formulas
    if (analysis.formulas.length > 0) {
      addNewPageIfNeeded(15);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Formulas:', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('courier', 'normal');
      analysis.formulas.forEach(formula => {
        addNewPageIfNeeded(6);
        pdf.text(`• ${formula}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Visual elements
    if (analysis.visual_elements.length > 0) {
      addNewPageIfNeeded(15);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Visual Elements:', margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      analysis.visual_elements.forEach(element => {
        addNewPageIfNeeded(6);
        pdf.text(`• ${element}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    // Important points
    if (analysis.emphasis_markers.length > 0) {
      addNewPageIfNeeded(15);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Important Points:', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      analysis.emphasis_markers.forEach(marker => {
        addNewPageIfNeeded(6);
        pdf.text(`⚡ ${marker}`, margin + 5, yPos);
        yPos += 6;
      });
    }
  });

  // Glossary
  const allDefinitions: Record<string, string> = {};
  analyses.forEach(a => {
    Object.assign(allDefinitions, a.definitions);
  });

  if (Object.keys(allDefinitions).length > 0) {
    pdf.addPage();
    yPos = margin;
    
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Glossary', margin, yPos);
    yPos += 15;

    pdf.setFontSize(10);
    const sortedTerms = Object.keys(allDefinitions).sort();
    sortedTerms.forEach(term => {
      addNewPageIfNeeded(15);
      pdf.setFont('helvetica', 'bold');
      pdf.text(term, margin, yPos);
      yPos += 6;

      pdf.setFont('helvetica', 'normal');
      const defLines = pdf.splitTextToSize(allDefinitions[term], maxWidth);
      defLines.forEach((line: string) => {
        addNewPageIfNeeded(5);
        pdf.text(line, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 5;
    });
  }

  // Save PDF
  const fileName = `${collectionTitle.replace(/[^a-z0-9]/gi, '_')}_Study_Materials.pdf`;
  pdf.save(fileName);
}
