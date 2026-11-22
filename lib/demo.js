'use strict';
// Example answers for when no AI key is configured: the whole flow (analyse pages, generate a
// quiz, play it) works without sending anything anywhere. Everything here is marked demo: true
// by the caller, and the UI says clearly that these are examples.

const PAGES = [
  {
    extracted_text:
      'Fotosyntesen är den process där gröna växter, alger och vissa bakterier bygger energirikt druvsocker av koldioxid och vatten. Energin kommer från solljuset och fångas upp av det gröna färgämnet klorofyll, som finns i cellernas kloroplaster.\n\n' +
      'Koldioxiden tas upp ur luften genom små öppningar på bladens undersida, klyvöppningarna. Vattnet sugs upp av rötterna och transporteras upp till bladen. När druvsocker bildas blir syre över, och det släpps ut genom klyvöppningarna.\n\n' +
      'Druvsockret använder växten både som bränsle och som byggmaterial. Det kan kopplas ihop till stärkelse, som lagras, och till cellulosa, som bygger upp cellväggarna. Eftersom växterna gör sin egen näring kallas de producenter – de är början på nästan alla näringskedjor.',
    major_topics: ['Fotosyntes'],
    key_concepts: ['Klorofyll', 'Kloroplaster', 'Klyvöppningar', 'Druvsocker', 'Ljusenergi', 'Producenter'],
    definitions: {
      Fotosyntes: 'Process där växter bildar druvsocker och syre av koldioxid och vatten med hjälp av ljusenergi.',
      Klorofyll: 'Det gröna färgämnet som fångar upp ljusenergin.',
      Kloroplast: 'Den del av växtcellen där fotosyntesen sker.',
      Klyvöppning: 'Liten öppning i bladet där gaser och vattenånga passerar.',
      Producent: 'Organism som själv bildar energirik näring, till exempel en grön växt.',
    },
    formulas: ['koldioxid + vatten + ljusenergi → druvsocker + syre', '6 CO₂ + 6 H₂O + ljusenergi → C₆H₁₂O₆ + 6 O₂'],
    visual_elements: ['Bild: Blad i genomskärning', 'Diagram: Fotosyntesens ämnen in och ut'],
    emphasis_markers: ['Växter äter inte jord – de bygger sig själva av luft och vatten.', 'Utan fotosyntes, inget syre och ingen mat.'],
    learning_objectives: [],
    is_foundational: true,
  },
  {
    extracted_text:
      'Cellandningen är den process där celler frigör energin som finns lagrad i druvsocker. Druvsockret reagerar med syre, och då bildas koldioxid och vatten samtidigt som energi frigörs. Cellandningen sker i cellernas mitokondrier.\n\n' +
      'Alla levande celler har cellandning – även växternas. Växter gör alltså både fotosyntes och cellandning. Fotosyntesen sker bara i ljus, medan cellandningen pågår dygnet runt.\n\n' +
      'Fotosyntes och cellandning hänger ihop som ett kretslopp: det som bildas i den ena processen används i den andra. I ljus går växtens fotosyntes fortare än dess cellandning, och därför ger växten ifrån sig mer syre än den förbrukar.',
    major_topics: ['Cellandning', 'Kretslopp'],
    key_concepts: ['Mitokondrier', 'Energi', 'Druvsocker', 'Syre', 'Koldioxid', 'Kretslopp'],
    definitions: {
      Cellandning: 'Process där celler frigör energi ur druvsocker med hjälp av syre.',
      Mitokondrie: 'Den del av cellen där cellandningen sker – cellens kraftverk.',
      Kretslopp: 'När ämnen används om och om igen i naturen.',
    },
    formulas: ['druvsocker + syre → koldioxid + vatten + energi', 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + energi'],
    visual_elements: ['Diagram: Kretslopp mellan fotosyntes och cellandning'],
    emphasis_markers: ['Även växter har cellandning – hela dygnet.'],
    learning_objectives: [],
    is_foundational: false,
  },
];

const OBJECTIVES = {
  extracted_text: 'Lärandemål för arbetsområdet fotosyntes och cellandning: eleven ska kunna beskriva processerna, förklara hur de hänger ihop och resonera om deras betydelse för livet på jorden.',
  major_topics: ['Fotosyntes', 'Cellandning'],
  key_concepts: ['Ordformler', 'Energiomvandling', 'Kretslopp', 'Näringskedjor'],
  definitions: {},
  formulas: [],
  visual_elements: [],
  emphasis_markers: [],
  learning_objectives: [
    'Kunna beskriva vad som händer i fotosyntesen och skriva dess ordformel.',
    'Kunna förklara varför växter kallas producenter.',
    'Kunna förklara hur fotosyntes och cellandning hänger ihop.',
    'Kunna föra utvecklade resonemang om fotosyntesens betydelse för livet på jorden.',
  ],
  is_foundational: false,
};

/** The canned analysis of one page: two example pages in turn, or the example learning goals. */
function demoAnalysis(type, pageNumber) {
  return type === 'learning_objectives' ? OBJECTIVES : PAGES[(pageNumber - 1) % PAGES.length];
}

const q = (question, correct_answer, wrong_answers, explanation, misconception_targeted, exam_tip, meta) => ({
  question, correct_answer, wrong_answers, explanation, misconception_targeted, exam_tip, ...meta,
});
const FOTO = 'Fotosyntes';
const CELL = 'Cellandning';
const KRETS = 'Kretslopp';

const QUESTIONS = [
  // ---- quiz 1: the foundation
  q('Vad behöver en växt för att kunna göra fotosyntes?',
    'Koldioxid, vatten och ljusenergi',
    ['Syre, vatten och ljusenergi', 'Jord, vatten och värme', 'Druvsocker, syre och ljus'],
    'Fotosyntesen bygger druvsocker av koldioxid och vatten, och energin kommer från ljus. Syre är inget växten behöver till fotosyntesen – det är det som blir över. Tänk: det vi andas ut (koldioxid) är det växten tar in.',
    'Att växter "andas in" syre till fotosyntesen, precis som vi andas.',
    'Råvarorna i fotosyntesen frågas det nästan alltid om. Lär dig ordformeln utantill, så har du svaret.',
    { difficulty: 'easy', bloom_level: 'remember', question_type: 'recall', topic_category: FOTO, exam_likelihood: 'very_high', page_references: ['Sida 1'] }),
  q('Vilka ämnen bildas i fotosyntesen?',
    'Druvsocker och syre',
    ['Koldioxid och vatten', 'Druvsocker och koldioxid', 'Syre och klorofyll'],
    'Av koldioxid och vatten bildas druvsocker (växtens näring) och syre (som blir över). Koldioxid och vatten är tvärtom det som går in. Klorofyllet bildas inte – det är verktyget som fångar ljuset.',
    'Att blanda ihop vad som går in i och vad som kommer ut ur fotosyntesen.',
    'Rita en pil: vänster om pilen står det som går in, höger det som bildas. Öva tills du kan den i sömnen.',
    { difficulty: 'easy', bloom_level: 'remember', question_type: 'recall', topic_category: FOTO, exam_likelihood: 'very_high', page_references: ['Sida 1'] }),
  q('Var i växtcellen sker fotosyntesen?',
    'I kloroplasterna',
    ['I mitokondrierna', 'I cellkärnan', 'I klyvöppningarna'],
    'Kloroplasterna innehåller klorofyll, som fångar ljuset – där sker fotosyntesen. Mitokondrierna sköter cellandningen, alltså den omvända processen. Klyvöppningar är hål i bladet, inte en del av cellen.',
    'Att förväxla kloroplaster (fotosyntes) med mitokondrier (cellandning).',
    'Minnesregel: KLORoplast – KLORofyll – grönt. Mitokondrien är "kraftverket" som gör cellandning.',
    { difficulty: 'easy', bloom_level: 'remember', question_type: 'recall', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1'] }),
  q('Varför ser de flesta blad gröna ut?',
    'Klorofyllet tar upp rött och blått ljus men reflekterar det gröna',
    ['Klorofyllet tar upp grönt ljus bäst av alla färger', 'Bladens cellväggar är gröna', 'Solljus blir grönt när det passerar genom luften'],
    'Den färg vi ser är det ljus som studsar tillbaka. Klorofyll använder främst rött och blått ljus, och det gröna reflekteras – därför ser bladet grönt ut. Det är lätt att tro att växten "gillar" grönt ljus, men det är precis det ljuset den använder sämst.',
    'Att färgen vi ser är den färg som tas upp, i stället för den som reflekteras.',
    'En klassisk "förklara varför"-fråga. Visa att du förstår skillnaden mellan att ta upp och att reflektera ljus.',
    { difficulty: 'medium', bloom_level: 'understand', question_type: 'application', topic_category: FOTO, exam_likelihood: 'medium', page_references: ['Sida 1'] }),
  q('En stor tall väger flera ton. Varifrån kommer det mesta av trädets massa?',
    'Från koldioxiden i luften och från vatten',
    ['Från jorden som rötterna tar upp', 'Från mineralerna i marken', 'Från solljuset, som omvandlas till ved'],
    'Trädet bygger druvsocker av koldioxid och vatten, och av sockret bygger det cellulosa – ved. Kolet i veden kommer alltså ur luften. Jorden ger bara små mängder mineraler, och ljuset ger energi, inte materia.',
    'Att växter "äter" jord och växer av det rötterna suger upp.',
    'Ett favoritexempel för högre betyg: förklara med ordformeln att kolatomerna i veden kommer från koldioxid.',
    { difficulty: 'medium', bloom_level: 'apply', question_type: 'application', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1'] }),
  q('En krukväxt ställs i ett helt mörkt rum. Vad händer med dess fotosyntes?',
    'Den stannar, eftersom ljusenergin saknas',
    ['Den fortsätter som vanligt så länge växten får vatten', 'Den går baklänges, så att växten gör koldioxid av syre', 'Den fortsätter med hjälp av värmen i rummet'],
    'Utan ljus finns ingen energi som kan driva fotosyntesen, så den stannar. Att växten ändå avger koldioxid i mörker beror på cellandningen – en egen process, inte fotosyntes baklänges. Värme kan inte ersätta ljus.',
    'Att cellandning är "fotosyntes baklänges" och att värme kan ersätta ljus.',
    'Frågor om vad som händer när en faktor tas bort testar om du förstår, inte bara minns. Fråga dig: vilken råvara eller energi saknas?',
    { difficulty: 'medium', bloom_level: 'apply', question_type: 'application', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1', 'Sida 2'] }),
  q('Vilken uppgift har bladens klyvöppningar?',
    'De släpper in koldioxid och släpper ut syre och vattenånga',
    ['De suger upp vatten ur marken', 'De fångar upp solljuset', 'De transporterar druvsocker till rötterna'],
    'Klyvöppningarna är små hål där gaser passerar: koldioxid in, syre och vattenånga ut. Vatten tas upp av rötterna, och ljuset fångas av klorofyllet inne i cellerna.',
    'Att blanda ihop bladets olika delar och vad rötterna gör.',
    'Koppla alltid en del till dess uppgift: klyvöppning – gaser, rot – vatten, klorofyll – ljus.',
    { difficulty: 'easy', bloom_level: 'understand', question_type: 'recall', topic_category: FOTO, exam_likelihood: 'medium', page_references: ['Sida 1'] }),
  q('Vilken ordformel beskriver fotosyntesen?',
    'koldioxid + vatten + ljusenergi → druvsocker + syre',
    ['druvsocker + syre → koldioxid + vatten + energi', 'koldioxid + syre + ljusenergi → druvsocker + vatten', 'vatten + syre + ljusenergi → druvsocker + koldioxid'],
    'Koldioxid och vatten går in, ljuset ger energin, och ut kommer druvsocker och syre. Formeln med druvsocker och syre till vänster är cellandningen – samma ämnen, men åt andra hållet.',
    'Att förväxla fotosyntesens formel med cellandningens.',
    'Ordformeln ger nästan alltid poäng. Skriv den överst på provet så fort du får det i handen.',
    { difficulty: 'medium', bloom_level: 'remember', question_type: 'recall', topic_category: FOTO, exam_likelihood: 'very_high', page_references: ['Sida 1'] }),
  q('Vad använder växten druvsockret till?',
    'Som bränsle i cellandningen och som byggmaterial, till exempel cellulosa',
    ['Bara till att göra frukterna söta', 'Det släpps ut genom klyvöppningarna', 'Det omvandlas direkt till syre'],
    'Druvsockret är både energi och byggstenar: en del förbränns i cellandningen, en del kopplas ihop till stärkelse (lager) och cellulosa (cellväggar). Syret kommer från vattnet, inte från sockret.',
    'Att socker bara handlar om söt smak, eller att det lämnar växten.',
    'Nämn båda användningarna – energi OCH byggmaterial – för ett fullständigt svar.',
    { difficulty: 'medium', bloom_level: 'understand', question_type: 'application', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1'] }),
  q('Varför kallas växter för producenter i en näringskedja?',
    'De bygger energirik näring av koldioxid och vatten, och den näringen lever resten av kedjan på',
    ['De producerar flest avkommor av alla organismer', 'De producerar syre som djuren använder som föda', 'De producerar mineraler som gör jorden bördig'],
    'Producenter gör egen näring med solens energi. Växtätare äter växterna och rovdjur äter växtätarna – all energi i kedjan kommer från fotosyntesen. Syre är viktigt, men det är inte föda.',
    'Att "producent" handlar om syre eller om antal, inte om att bilda energirik näring.',
    'Koppla begreppet producent till energi: solen → växten → djuren. Det resonemanget lyfter svaret.',
    { difficulty: 'medium', bloom_level: 'analyze', question_type: 'analysis', topic_category: FOTO, exam_likelihood: 'very_high', page_references: ['Sida 1'] }),

  // ---- quiz 2: going deeper
  q('Hur hänger fotosyntes och cellandning ihop?',
    'Det som bildas i den ena processen är det som används i den andra',
    ['De är samma process med två olika namn', 'Fotosyntes sker i växter och cellandning bara i djur', 'Cellandning är fotosyntes som sker på natten'],
    'Fotosyntesen bildar druvsocker och syre, som cellandningen använder. Cellandningen bildar koldioxid och vatten, som fotosyntesen använder. Två olika processer, i olika delar av cellen – tillsammans ett kretslopp.',
    'Att cellandningen bara är fotosyntesens "nattläge", eller att bara djur har den.',
    'Rita kretsloppet med två pilar i en ring. Kan du rita det, kan du förklara det.',
    { difficulty: 'medium', bloom_level: 'analyze', question_type: 'analysis', topic_category: KRETS, exam_likelihood: 'very_high', page_references: ['Sida 2'] }),
  q('Har växter cellandning?',
    'Ja, dygnet runt i alla levande celler',
    ['Nej, bara djur har cellandning', 'Ja, men bara på natten', 'Ja, men bara i rötterna'],
    'Alla levande celler behöver frigöra energi, så växtens celler har cellandning hela tiden. I ljus märks den mindre, eftersom fotosyntesen då går fortare – men den pågår ändå.',
    'Att växter gör fotosyntes i stället för cellandning, eller växlar mellan dem dag och natt.',
    'En vanlig fälla! Skriv "även växter har cellandning, dygnet runt" i dina anteckningar.',
    { difficulty: 'easy', bloom_level: 'understand', question_type: 'recall', topic_category: CELL, exam_likelihood: 'very_high', page_references: ['Sida 2'] }),
  q('Var i cellen sker cellandningen?',
    'I mitokondrierna',
    ['I kloroplasterna', 'I cellkärnan', 'I cellväggen'],
    'Mitokondrierna är cellens kraftverk – där frigörs energin ur druvsockret. Kloroplasterna gör fotosyntes. Cellkärnan styr cellen, och cellväggen ger stadga.',
    'Att förväxla mitokondrier och kloroplaster.',
    'Para ihop: kloroplast – fotosyntes, mitokondrie – cellandning.',
    { difficulty: 'easy', bloom_level: 'remember', question_type: 'recall', topic_category: CELL, exam_likelihood: 'high', page_references: ['Sida 2'] }),
  q('Ett akvarium med vattenpest ställs i starkt ljus, och små bubblor stiger från växten. Vad innehåller bubblorna mest?',
    'Syre som bildats i fotosyntesen',
    ['Koldioxid som växten andas ut', 'Luft som växten har sugit upp', 'Vattenånga, eftersom lampan värmer vattnet'],
    'I starkt ljus går fotosyntesen fort, och syret som blir över syns som bubblor. Växten avger också lite koldioxid från cellandningen, men i ljus tas den upp igen av fotosyntesen.',
    'Att växter alltid "andas ut" koldioxid, som djur.',
    'Det här är ett vanligt laborationsexempel. Koppla det du ser (bubblor) till ordformeln (syre bildas).',
    { difficulty: 'medium', bloom_level: 'apply', question_type: 'application', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1', 'Sida 2'] }),
  q('Ljuset ökas mer och mer över en växt, men luften innehåller mycket lite koldioxid. Vad händer med fotosyntesens hastighet?',
    'Den ökar bara till en viss gräns – sedan sätter bristen på koldioxid stopp',
    ['Den ökar lika mycket som ljuset ökar, utan gräns', 'Den minskar direkt, eftersom ljus förstör klorofyllet', 'Den påverkas inte alls av ljuset'],
    'Fotosyntesen behöver både energi och råvaror. Mer ljus hjälper bara så länge det finns koldioxid att bygga av – sedan är det råvaran som begränsar. Som en bagare: fler ugnar hjälper inte när mjölet är slut.',
    'Att mer ljus alltid ger mer fotosyntes.',
    'Resonemang om begränsande faktorer visar djup förståelse. Nämn alltid både energi och råvaror.',
    { difficulty: 'hard', bloom_level: 'analyze', question_type: 'analysis', topic_category: FOTO, exam_likelihood: 'medium', page_references: ['Sida 1'] }),
  q('En växt som står mörkt i flera veckor dör till slut, trots att den får vatten. Varför?',
    'Den gör slut på sitt lagrade socker i cellandningen och kan inte bilda nytt',
    ['Den kvävs, eftersom den inte får något syre', 'Den fryser utan solens värme', 'Rötterna kan inte ta upp vatten i mörker'],
    'Cellandningen pågår hela tiden och förbrukar druvsocker. Utan ljus bildas inget nytt, så växten svälter när lagret tar slut. Syre finns det gott om i luften – det är energin som tar slut.',
    'Att ljus behövs för värme eller för att ta upp vatten, inte för att bilda näring.',
    'Här behöver du kombinera båda processerna i ditt svar – precis det som krävs för de högre betygen.',
    { difficulty: 'hard', bloom_level: 'analyze', question_type: 'synthesis', topic_category: KRETS, exam_likelihood: 'high', page_references: ['Sida 1', 'Sida 2'] }),
  q('I vilken form finns solens energi lagrad efter fotosyntesen?',
    'Som kemisk energi i druvsockret',
    ['Som värme i bladen', 'Som ljus inne i klorofyllet', 'Som rörelseenergi i växtens saft'],
    'Fotosyntesen omvandlar ljusenergi till kemisk energi, bunden i druvsockret. Det är den energin som frigörs i cellandningen – hos växten själv eller hos den som äter växten.',
    'Att energin "försvinner" eller stannar kvar som ljus eller värme.',
    'Ordet energiomvandling ger tyngd åt svaret: ljusenergi → kemisk energi.',
    { difficulty: 'medium', bloom_level: 'understand', question_type: 'application', topic_category: FOTO, exam_likelihood: 'high', page_references: ['Sida 1', 'Sida 2'] }),
  q('Varför är fotosyntesen viktig även för ett rovdjur som bara äter kött?',
    'Bytesdjurens energi kommer från växter de ätit, och syret rovdjuret andas har bildats i fotosyntesen',
    ['Den är inte viktig – köttätare klarar sig utan växter', 'Bara för syrets skull; energin i kött har inget med växter att göra', 'För att växterna håller temperaturen lagom för rovdjuret'],
    'Följ energin bakåt i näringskedjan: rovdjur → växtätare → växt → solen. All energi i köttet har en gång fångats i fotosyntesen. Dessutom kommer syret därifrån.',
    'Att energin i kött uppstår hos djuret självt och inte kommer från växter.',
    'Följ energin bakåt till solen – ett resonemang i flera led visar att du ser helheten.',
    { difficulty: 'hard', bloom_level: 'evaluate', question_type: 'synthesis', topic_category: KRETS, exam_likelihood: 'high', page_references: ['Sida 1', 'Sida 2'] }),
  q('När under dygnet tar en växt upp mer koldioxid än den avger?',
    'I ljus, när fotosyntesen går fortare än cellandningen',
    ['På natten, när fotosyntesen vilar', 'Aldrig – växter avger alltid mest koldioxid', 'Lika mycket hela dygnet'],
    'Cellandningen avger koldioxid hela dygnet. I ljus tar fotosyntesen upp betydligt mer koldioxid än så, så nettot blir ett upptag. I mörker finns bara cellandningen kvar, och då avges koldioxid.',
    'Att växten bara gör en process i taget.',
    'Använd ordet "netto" – det visar att du vet att båda processerna pågår samtidigt.',
    { difficulty: 'hard', bloom_level: 'analyze', question_type: 'analysis', topic_category: KRETS, exam_likelihood: 'medium', page_references: ['Sida 2'] }),
  q('Vilket resonemang förklarar bäst varför stora skogar påverkar mängden koldioxid i luften?',
    'Växande skog binder kol ur luftens koldioxid i veden; när veden bränns eller bryts ner frigörs kolet igen',
    ['Skogen gör allt syre vi andas, så utan skog tar syret slut på en gång', 'Träd skuggar marken – koldioxiden påverkas inte alls', 'Skog avger mer koldioxid än den tar upp, eftersom träd har cellandning'],
    'Ett träd som växer lagrar mer kol (fotosyntes) än det släpper ut (cellandning) – kolet hamnar i veden. Eldas eller ruttnar veden blir kolet koldioxid igen. Svaret om syre har en poäng, men det överdriver och förklarar inte koldioxiden.',
    'Att överdriva en delsanning (syre) eller glömma att fotosyntesen binder mer kol än cellandningen släpper ut i en växande skog.',
    'Frågor av typen "vilket resonemang är bäst" kräver att du väger alternativen. Välj det som förklarar orsak och verkan i flera led.',
    { difficulty: 'hard', bloom_level: 'evaluate', question_type: 'synthesis', topic_category: KRETS, exam_likelihood: 'medium', page_references: ['Sida 1', 'Sida 2'] }),
];

const TITLES = [
  ['Grunderna i fotosyntesen', 'Vad går in, vad kommer ut och var sker det? Tio frågor om grunderna.'],
  ['Fördjupning: fotosyntes och cellandning', 'Hur hänger processerna ihop – och vad händer när något ändras?'],
  ['Fotosyntesen – utmaningen', 'En blandning av grund och fördjupning, i ny ordning.'],
];

/** A canned quiz shaped like the model's answer. quizCount = quizzes the collection already has. */
function demoQuiz(quizCount) {
  let questions;
  if (quizCount % 3 === 0) questions = QUESTIONS.slice(0, 10);
  else if (quizCount % 3 === 1) questions = QUESTIONS.slice(10, 20);
  else questions = QUESTIONS.filter((_, i) => i % 2 === (quizCount % 2));
  const [title, description] = TITLES[quizCount % 3];
  return {
    title: quizCount < 3 ? title : `${title} (${Math.floor(quizCount / 3) + 1})`,
    description,
    teaching_reasoning: 'Exempelquiz: fel svar bygger på vanliga missuppfattningar, som att växter äter jord eller att bara djur har cellandning.',
    content_analysis: {
      major_topics: [FOTO, CELL, KRETS],
      total_pages_analyzed: 2,
      recommended_question_count: 10,
      identified_misconceptions: ['Växter äter jord', 'Bara djur har cellandning', 'Cellandning är fotosyntes baklänges'],
    },
    questions,
  };
}

module.exports = { demoAnalysis, demoQuiz };
