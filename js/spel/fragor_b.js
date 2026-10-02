// Frågor & spel – innehåll del 2: Pengar & ekonomi, Lära känna varandra, Fritid & hobbys, Framtiden & drömmar.
// Egna frågor skrivna för vloggen. Id:n är stabila – svaren sparas per paket-id + fråge-id, så byt aldrig ett id i efterhand.
// 2026-10-02: frågor som redan fanns i del 1 (eller i ett annat paket) är borttagna; deras id lämnas lediga och nya
// frågor har fått nya id (t.ex. kanna-aldrig f14–f17). tests/spel_data.test.js vaktar mot nya dubbletter.
(function (VL) {
  VL.spelData = VL.spelData || { kategorier: [] };

  // ---------- Pengar & ekonomi ----------
  VL.spelData.kategorier.push({ id: 'pengar', namn: 'Pengar & ekonomi', emoji: '💸', farg: 'gron', vuxen: false, paket: [
    { id: 'pengar-vardag', titel: 'Pengar i vardagen', typ: 'samtal', emoji: '💳', fragor: [
      { id: 'f1', text: 'Vad lärde du dig om pengar hemma när du var liten?' },
      { id: 'f2', text: 'Vad får dig att känna dig rik, även när kontot är nästan tomt?' },
      { id: 'f3', text: 'Vilket köp har gjort dig gladast det senaste året?' },
      { id: 'f4', text: 'Vilket köp ångrar du mest, och vad lärde du dig av det?' },
      { id: 'f5', text: 'Är du den som räknar noga eller den som chansar? Berätta.' },
      { id: 'f6', text: 'Hur känns det för dig att prata om pengar med mig?' },
      { id: 'f7', text: 'Vad lägger du gärna pengar på som andra kanske tycker är onödigt?' },
      { id: 'f8', text: 'Vad gör dig stressad när det gäller pengar?' },
      { id: 'f9', text: 'Hur vill du att vi gör när vi betalar för saker tillsammans?' },
      { id: 'f10', text: 'Finns det något du sparar till just nu?' },
      { id: 'f11', text: 'Hur ser en lagom dyr dejt ut för dig?' },
      { id: 'f12', text: 'Vad betyder trygghet med pengar för dig?' }
    ] },
    { id: 'pengar-val', titel: 'Spara eller unna sig?', typ: 'val', emoji: '⚖️', fragor: [
      { id: 'f1', text: 'Vi får en extra tusenlapp. Vad gör vi?', a: 'Sparar den', b: 'Unnar oss något' },
      { id: 'f2', text: 'När lönen kommer?', a: 'Betalar allt direkt', b: 'Tar det när det kommer' },
      { id: 'f3', text: 'Hur betalar du helst?', a: 'Kort eller mobil', b: 'Kontanter' },
      { id: 'f4', text: 'Vilken present känns mest?', a: 'Något köpt', b: 'Något hemgjort' },
      { id: 'f5', text: 'Semester?', a: 'Enkelt men länge', b: 'Lyxigt men kort' },
      { id: 'f6', text: 'Pengar i ett par?', a: 'Allt gemensamt', b: 'Var för sig' },
      { id: 'f7', text: 'En vanlig fredag?', a: 'Laga mat hemma', b: 'Äta ute' },
      { id: 'f8', text: 'Inför ett stort köp?', a: 'Bestämmer direkt', b: 'Sover på saken' },
      { id: 'f9', text: 'Kläder?', a: 'Få men dyra', b: 'Många och billiga' },
      { id: 'f10', text: 'Hellre spendera på?', a: 'En upplevelse', b: 'En sak' },
      { id: 'f11', text: 'Vi vinner på lotto. Första tanken?', a: 'Resa iväg', b: 'Spara allt' },
      { id: 'f12', text: 'Flygbiljett?', a: 'Billigaste', b: 'Bästa tiden' }
    ] },
    { id: 'pengar-aldrig', titel: 'Jag har aldrig – plånboken', typ: 'aldrig', emoji: '🙈', fragor: [
      { id: 'f1', text: 'Jag har aldrig ångrat ett köp samma dag.' },
      { id: 'f2', text: 'Jag har aldrig gömt ett kvitto för att slippa förklara ett köp.' },
      { id: 'f3', text: 'Jag har aldrig lånat pengar av en kompis.' },
      { id: 'f4', text: 'Jag har aldrig glömt att betala en räkning.' },
      { id: 'f5', text: 'Jag har aldrig haft en sparbössa som vuxen.' },
      { id: 'f6', text: 'Jag har aldrig köpt något bara för att det var rea.' },
      { id: 'f7', text: 'Jag har aldrig tappat bort pengar.' },
      { id: 'f8', text: 'Jag har aldrig sålt något jag inte längre behövde.' },
      { id: 'f9', text: 'Jag har aldrig handlat på nätet mitt i natten.' },
      { id: 'f10', text: 'Jag har aldrig gjort en budget som jag faktiskt följt.' },
      { id: 'f11', text: 'Jag har aldrig betalat alldeles för mycket för en souvenir.' },
      { id: 'f12', text: 'Jag har aldrig hittat pengar på gatan.' },
      { id: 'f13', text: 'Jag har aldrig ångrat att jag inte köpte något.' }
    ] },
    { id: 'pengar-gissa', titel: 'Gissa hur jag handlar', typ: 'gissa', emoji: '🎯', fragor: [
      { id: 'f1', text: 'Vad lägger jag helst lite extra pengar på?', val: ['Mat', 'Kläder', 'Resor', 'Teknik'] },
      { id: 'f2', text: 'Hur betalar jag oftast?', val: ['Kort', 'Mobilen', 'Kontanter'] },
      { id: 'f3', text: 'Vad gör jag om jag får oväntade pengar?', val: ['Sparar', 'Unnar mig något', 'Bjuder dig', 'Delar med familjen'] },
      { id: 'f4', text: 'Hur länge funderar jag innan ett stort köp?', val: ['Inte alls', 'Några dagar', 'Några veckor', 'Månader'] },
      { id: 'f5', text: 'I vilken butik kan jag gå vilse i timmar?', val: ['Klädbutik', 'Elektronik', 'Matbutik', 'Bokhandel'] },
      { id: 'f6', text: 'Vad tycker jag är värt att betala mer för?', val: ['En bra säng', 'God mat', 'Bra skor', 'En bra mobil'] },
      { id: 'f7', text: 'Hur ofta kollar jag mitt saldo?', val: ['Varje dag', 'Varje vecka', 'Sällan', 'Nästan aldrig'] },
      { id: 'f8', text: 'Vad gör jag när det är rea?', val: ['Fyndar massor', 'Köper en sak', 'Håller mig borta'] },
      { id: 'f9', text: 'Vilken present blir jag gladast av?', val: ['Något dyrt', 'Något personligt', 'En upplevelse', 'Något gott'] },
      { id: 'f10', text: 'Hur handlar jag mat?', val: ['Med lista', 'På känn', 'Hungrig och utan plan'] },
      { id: 'f11', text: 'Vad skulle jag lägga en miljon på först?', val: ['Ett hem', 'En resa', 'En bil', 'Familjen'] },
      { id: 'f12', text: 'Vilken sorts sparare är jag?', val: ['En ekorre', 'En slösare', 'Lite av båda'] }
    ] },
    { id: 'pengar-mal', titel: 'Mål och drömmar med pengar', typ: 'samtal', emoji: '🏦', fragor: [
      { id: 'f1', text: 'Vad skulle du göra med dina dagar om du inte behövde jobba för pengarna?' },
      { id: 'f2', text: 'Vad vill du att vi har råd med om fem år?' },
      { id: 'f3', text: 'Vilken resa skulle du vilja att vi sparar till tillsammans?' },
      { id: 'f4', text: 'Hur tänker du kring att hjälpa familjen med pengar?' },
      { id: 'f5', text: 'Vad är viktigast för dig: att ha mycket, eller att ha lagom och mer tid över?' },
      { id: 'f6', text: 'Hur skulle en bra gemensam budget se ut för oss?' },
      { id: 'f7', text: 'Finns det något om pengar som du skulle vilja lära dig mer om?' },
      { id: 'f8', text: 'Vilken dröm kostar pengar men är något du aldrig vill ge upp?' },
      { id: 'f9', text: 'Om vi bor ihop en dag, hur vill du att vi delar på kostnaderna?' },
      { id: 'f10', text: 'Vad skulle du köpa om du fick slösa en enda gång helt utan dåligt samvete?' },
      { id: 'f11', text: 'Vad betyder det för dig att vara generös?' },
      { id: 'f12', text: 'Hur vill du att vi pratar om pengar när det känns svårt?' }
    ] }
  ] });

  // ---------- Lära känna varandra ----------
  VL.spelData.kategorier.push({ id: 'kanna', namn: 'Lära känna varandra', emoji: '👫', farg: 'turkos', vuxen: false, paket: [
    { id: 'kanna-barndom', titel: 'Barndom och uppväxt', typ: 'samtal', emoji: '🧸', fragor: [
      { id: 'f1', text: 'Vad lekte du helst när du var liten?' },
      { id: 'f2', text: 'Vilket är ditt allra tidigaste minne?' },
      { id: 'f3', text: 'Vem var din bästa vän som barn, och vad hittade ni på?' },
      { id: 'f4', text: 'Vad var du rädd för när du var liten?' },
      { id: 'f5', text: 'Vilken mat från din barndom längtar du fortfarande efter?' },
      { id: 'f6', text: 'Vad ville du bli när du blev stor?' },
      { id: 'f7', text: 'Vilken vuxen betydde mest för dig när du växte upp?' },
      { id: 'f8', text: 'Vad är det busigaste du gjorde som barn?' },
      { id: 'f9', text: 'Hur firade ni födelsedagar i din familj?' },
      { id: 'f10', text: 'Vilken låt eller film får dig att tänka på när du var liten?' },
      { id: 'f11', text: 'Vilken plats från din barndom skulle du vilja visa mig?' },
      { id: 'f12', text: 'Vad skulle du vilja säga till dig själv som tioåring?' }
    ] },
    { id: 'kanna-val', titel: 'Snabba val om dig', typ: 'val', emoji: '⚡', fragor: [
      { id: 'f1', text: 'Vad är du mest?', a: 'Morgonmänniska', b: 'Nattuggla' },
      { id: 'f4', text: 'Semester?', a: 'Sol och bad', b: 'Storstad' },
      { id: 'f5', text: 'När du saknar någon?', a: 'Ringer', b: 'Skriver' },
      { id: 'f6', text: 'En film som får dig att…', a: 'Skratta', b: 'Gråta' },
      { id: 'f8', text: 'En ledig dag?', a: 'Planerad', b: 'Spontan' },
      { id: 'f9', text: 'Årstid?', a: 'Sommar', b: 'Vinter' },
      { id: 'f10', text: 'Fira något?', a: 'Stor fest', b: 'Liten middag' },
      { id: 'f11', text: 'När du är ledsen?', a: 'Vill prata', b: 'Vill vara ifred en stund' },
      { id: 'f12', text: 'Hemma?', a: 'Musik på högt', b: 'Skön tystnad' },
      { id: 'f13', text: 'Frukost?', a: 'En stor frukost', b: 'Bara något snabbt' }
    ] },
    { id: 'kanna-aldrig', titel: 'Jag har aldrig – små hemligheter', typ: 'aldrig', emoji: '🤫', fragor: [
      { id: 'f3', text: 'Jag har aldrig gråtit till en reklamfilm.' },
      { id: 'f7', text: 'Jag har aldrig pratat högt med mig själv i en affär.' },
      { id: 'f8', text: 'Jag har aldrig ljugit om min ålder.' },
      { id: 'f9', text: 'Jag har aldrig skrattat på helt fel ställe.' },
      { id: 'f11', text: 'Jag har aldrig sett samma serie tre gånger.' },
      { id: 'f12', text: 'Jag har aldrig gömt godis så att ingen annan skulle hitta det.' },
      { id: 'f14', text: 'Jag har aldrig sagt ”jag är på väg” innan jag ens hade gått hemifrån.' },
      { id: 'f15', text: 'Jag har aldrig googlat mig själv.' },
      { id: 'f16', text: 'Jag har aldrig tagit om samma selfie mer än tio gånger.' },
      { id: 'f17', text: 'Jag har aldrig sjungit fel text till en låt i flera år utan att märka det.' }
    ] },
    { id: 'kanna-gissa', titel: 'Gissa mina favoriter', typ: 'gissa', emoji: '🎯', fragor: [
      { id: 'f1', text: 'Vilken är min favoritfärg?', val: ['Svart', 'Rosa', 'Blå', 'Grön'] },
      { id: 'f6', text: 'Vilket kök älskar jag mest?', val: ['Thailändskt', 'Italienskt', 'Japanskt', 'Svenskt'] },
      { id: 'f7', text: 'Vilken tid på dygnet mår jag bäst?', val: ['Morgon', 'Eftermiddag', 'Kväll', 'Natt'] },
      { id: 'f8', text: 'Vilken frukt tar jag först?', val: ['Mango', 'Jordgubbar', 'Banan', 'Vattenmelon'] },
      { id: 'f10', text: 'Vad gör mig gladast en dålig dag?', val: ['God mat', 'Sömn', 'Ett samtal', 'Musik'] },
      { id: 'f11', text: 'Vilket väder gillar jag mest?', val: ['Sol', 'Regn', 'Snö', 'Mulet och mysigt'] },
      { id: 'f12', text: 'Hur vill jag helst bli väckt?', val: ['Med en puss', 'Med kaffe', 'Av mig själv', 'Med musik'] },
      { id: 'f13', text: 'Vilken emoji skickar jag oftast?', val: ['❤️', '😂', '🥰', '🙈'] },
      { id: 'f14', text: 'Vilken blomma blir jag gladast av?', val: ['Rosor', 'Tulpaner', 'Solrosor', 'Pioner'] },
      { id: 'f15', text: 'Vilken högtid tycker jag mest om?', val: ['Jul', 'Midsommar', 'Nyår', 'Påsk'] }
    ] },
    { id: 'kanna-djupare', titel: 'Lite djupare', typ: 'samtal', emoji: '🌊', fragor: [
      { id: 'f1', text: 'När känner du dig mest som dig själv?' },
      { id: 'f3', text: 'Vad tror du att folk ofta missförstår om dig?' },
      { id: 'f4', text: 'Vad behöver du när du har haft en jobbig dag?' },
      { id: 'f5', text: 'Vilken sida av dig vill du att jag ska lägga märke till?' },
      { id: 'f6', text: 'Vad har förändrat dig mest de senaste åren?' },
      { id: 'f7', text: 'Vad har du svårt att be om hjälp med?' },
      { id: 'f8', text: 'Vilken liten sak gör dig glad nästan varje gång?' },
      { id: 'f9', text: 'Hur visar du att du bryr dig om någon?' },
      { id: 'f10', text: 'Vad vill du att jag ska veta om dig, som du sällan säger högt?' },
      { id: 'f11', text: 'Vad har du lärt dig av ett misstag?' },
      { id: 'f12', text: 'Vad gör dig nervös, även när det inte syns utanpå?' }
    ] },
    { id: 'kanna-vanor', titel: 'Gissa mina vanor', typ: 'gissa', emoji: '🔍', fragor: [
      { id: 'f1', text: 'Vad gör jag först när jag vaknar?', val: ['Kollar mobilen', 'Går upp direkt', 'Snoozar', 'Dricker vatten'] },
      { id: 'f2', text: 'Hur länge kan jag sova en ledig dag?', val: ['Till sju', 'Till nio', 'Till elva', 'Hela dagen'] },
      { id: 'f3', text: 'Hur många gånger snoozar jag?', val: ['Aldrig', 'En gång', 'Två–tre', 'Tappar räkningen'] },
      { id: 'f4', text: 'Vad gör jag när jag inte kan sova?', val: ['Mobilen', 'Läser', 'Ligger och tänker', 'Går upp'] },
      { id: 'f5', text: 'När packar jag inför en resa?', val: ['Veckan innan', 'Dagen innan', 'Samma morgon'] },
      { id: 'f6', text: 'Hur ofta är jag sen?', val: ['Aldrig', 'Ibland', 'Ofta', 'Alltid'] },
      { id: 'f7', text: 'Vad gör jag när jag är stressad?', val: ['Städar', 'Äter', 'Går ut', 'Kryper ner i soffan'] },
      { id: 'f8', text: 'Hur snabbt svarar jag på meddelanden?', val: ['Direkt', 'Inom en timme', 'När jag hinner', 'Glömmer bort'] },
      { id: 'f9', text: 'Var i sängen sover jag helst?', val: ['Vänster', 'Höger', 'Mitten', 'Överallt'] },
      { id: 'f10', text: 'Vad har jag nästan alltid med mig?', val: ['Laddare', 'Läppbalsam', 'Något att äta', 'Hörlurar'] },
      { id: 'f11', text: 'Hur äter jag godis?', val: ['Allt på en gång', 'Lite i taget', 'Det bästa sist'] },
      { id: 'f12', text: 'Hur ser det oftast ut hemma hos mig?', val: ['Helt i ordning', 'Lite stökigt', 'Kaos med system'] }
    ] }
  ] });

  // ---------- Fritid & hobbys ----------
  VL.spelData.kategorier.push({ id: 'fritid', namn: 'Fritid & hobbys', emoji: '⚽', farg: 'bla', vuxen: false, paket: [
    { id: 'fritid-helg', titel: 'Helger och lediga dagar', typ: 'samtal', emoji: '🛋️', fragor: [
      { id: 'f1', text: 'Hur ser din perfekta lördag ut, från morgon till kväll?' },
      { id: 'f2', text: 'Vad gör du helst när du har en hel dag helt för dig själv?' },
      { id: 'f3', text: 'Vilken hobby har du alltid velat börja med?' },
      { id: 'f4', text: 'Vad gjorde du på fritiden när du var tonåring?' },
      { id: 'f5', text: 'Vilken aktivitet får dig att glömma bort tiden?' },
      { id: 'f6', text: 'Vilken serie skulle du vilja att vi ser samtidigt, fast på varsitt håll?' },
      { id: 'f7', text: 'Vilken sport är roligast att titta på, och vilken är roligast att spela?' },
      { id: 'f8', text: 'Vad gör du när du behöver ladda batterierna?' },
      { id: 'f9', text: 'Samlar du på något, eller har du gjort det någon gång?' },
      { id: 'f10', text: 'Vilket spel eller vilken app lägger du mest tid på?' },
      { id: 'f11', text: 'Vad är det bästa med en regnig dag hemma?' },
      { id: 'f12', text: 'Vilken låt sätter du på när du vill bli glad?' }
    ] },
    { id: 'fritid-val', titel: 'Det här eller det där – fritid', typ: 'val', emoji: '🎲', fragor: [
      { id: 'f1', text: 'Film?', a: 'På bio', b: 'I soffan' },
      { id: 'f2', text: 'Träning?', a: 'Gymmet', b: 'En lång promenad' },
      { id: 'f3', text: 'Spelkväll?', a: 'Brädspel', b: 'Tv-spel' },
      { id: 'f4', text: 'Konsert?', a: 'Stor arena', b: 'Litet ställe' },
      { id: 'f5', text: 'Berättelser?', a: 'Läsa en bok', b: 'Lyssna på en ljudbok' },
      { id: 'f6', text: 'I köket?', a: 'Laga mat', b: 'Baka' },
      { id: 'f7', text: 'En dag ute?', a: 'Naturen', b: 'Shopping' },
      { id: 'f8', text: 'Bada?', a: 'I havet', b: 'I en pool' },
      { id: 'f9', text: 'Musik?', a: 'Gamla favoriter', b: 'Nya låtar' },
      { id: 'f10', text: 'Längre resa?', a: 'Bil', b: 'Tåg' },
      { id: 'f11', text: 'Sport?', a: 'Titta på', b: 'Spela själv' },
      { id: 'f12', text: 'Fotografera?', a: 'Selfies', b: 'Utsikten' },
      { id: 'f13', text: 'Karaoke?', a: 'Sjunger först', b: 'Lyssnar helst' }
    ] },
    { id: 'fritid-aldrig', titel: 'Jag har aldrig – äventyr', typ: 'aldrig', emoji: '🧗', fragor: [
      { id: 'f1', text: 'Jag har aldrig åkt skidor.' },
      { id: 'f2', text: 'Jag har aldrig sovit i tält.' },
      { id: 'f3', text: 'Jag har aldrig sjungit karaoke inför främlingar.' },
      { id: 'f4', text: 'Jag har aldrig sett soluppgången efter en hel natt vaken.' },
      { id: 'f5', text: 'Jag har aldrig badat i havet mitt i natten.' },
      { id: 'f6', text: 'Jag har aldrig åkt berg-och-dalbana med händerna i luften.' },
      { id: 'f7', text: 'Jag har aldrig provat att dyka eller snorkla.' },
      { id: 'f8', text: 'Jag har aldrig gått på en konsert ensam.' },
      { id: 'f9', text: 'Jag har aldrig fått napp när jag fiskat.' },
      { id: 'f10', text: 'Jag har aldrig vandrat upp på ett riktigt högt berg.' },
      { id: 'f11', text: 'Jag har aldrig gått en danskurs.' },
      { id: 'f12', text: 'Jag har aldrig vunnit en tävling.' },
      { id: 'f13', text: 'Jag har aldrig ridit på en häst.' }
    ] },
    { id: 'fritid-gissa', titel: 'Gissa min fritid', typ: 'gissa', emoji: '🎯', fragor: [
      { id: 'f1', text: 'Vad gör jag helst en ledig kväll?', val: ['Ser en serie', 'Träffar vänner', 'Tränar', 'Somnar tidigt'] },
      { id: 'f2', text: 'Vilken sport skulle jag välja?', val: ['Fotboll', 'Simning', 'Badminton', 'Ingen alls'] },
      { id: 'f3', text: 'Vilken sorts musik spelar jag mest?', val: ['Pop', 'Rock', 'Hiphop', 'Lugnt och mjukt'] },
      { id: 'f4', text: 'Vad gör jag först på ett nöjesfält?', val: ['Värsta åkturen', 'Spelen', 'Äter något', 'Pariserhjulet'] },
      { id: 'f5', text: 'I vilket spel vill jag helst vinna över dig?', val: ['Kortspel', 'Brädspel', 'Tv-spel', 'Frågesport'] },
      { id: 'f6', text: 'Hur långt orkar jag promenera?', val: ['En kvart', 'En timme', 'Halva dagen', 'Hur långt som helst'] },
      { id: 'f7', text: 'Vilken sorts serie fastnar jag för?', val: ['Drama', 'Komedi', 'Dokumentär', 'Deckare'] },
      { id: 'f8', text: 'Vad gör jag mest på en strand?', val: ['Badar', 'Solar', 'Läser', 'Letar glass'] },
      { id: 'f9', text: 'Vilken hobby skulle jag helst vilja lära mig?', val: ['Måla', 'Dansa', 'Spela gitarr', 'Laga mat'] },
      { id: 'f10', text: 'Var hittar man mig på en fest?', val: ['Dansgolvet', 'Köket', 'Soffan', 'Vid maten'] },
      { id: 'f11', text: 'Hur ofta tränar jag?', val: ['Varje dag', 'Några gånger i veckan', 'Ibland', 'Nästan aldrig'] },
      { id: 'f12', text: 'Vad tar jag helst bilder på?', val: ['Mat', 'Naturen', 'Oss två', 'Allt möjligt'] }
    ] },
    { id: 'fritid-ihop', titel: 'Saker att göra ihop', typ: 'samtal', emoji: '🎒', fragor: [
      { id: 'f1', text: 'Vilken hobby skulle du vilja att vi provar tillsammans?' },
      { id: 'f2', text: 'Vad kan vi göra ihop även när vi är på olika platser?' },
      { id: 'f3', text: 'Vad är du bra på som du skulle vilja lära mig?' },
      { id: 'f4', text: 'Vilken kurs skulle vara rolig att gå tillsammans?' },
      { id: 'f5', text: 'Vilket spel spelar vi om vi får en hel regnig dag ihop?' },
      { id: 'f6', text: 'Vilken konsert eller festival skulle du vilja gå på med mig?' },
      { id: 'f7', text: 'Vad är det roligaste vi har gjort tillsammans hittills?' },
      { id: 'f8', text: 'Vilken maträtt skulle vi kunna laga samtidigt över ett videosamtal?' },
      { id: 'f9', text: 'Vilken utmaning skulle vi kunna göra tillsammans i en månad?' },
      { id: 'f10', text: 'Vilken plats nära dig vill du visa mig en ledig dag?' },
      { id: 'f11', text: 'Om vi startade en gemensam hobby i dag, vad skulle det bli?' },
      { id: 'f12', text: 'Vilken sorts utflykt gör dig gladast att planera?' }
    ] }
  ] });

  // ---------- Framtiden & drömmar ----------
  VL.spelData.kategorier.push({ id: 'framtid', namn: 'Framtiden & drömmar', emoji: '✨', farg: 'brun', vuxen: false, paket: [
    { id: 'framtid-drommar', titel: 'Stora drömmar', typ: 'samtal', emoji: '🌠', fragor: [
      { id: 'f1', text: 'Vad drömmer du om att hinna göra i livet?' },
      { id: 'f2', text: 'Om du fick leva vilket liv som helst i ett år, hur skulle det se ut?' },
      { id: 'f3', text: 'Vilken dröm har du burit på länge men sällan sagt högt?' },
      { id: 'f4', text: 'Var ser du dig själv om tio år?' },
      { id: 'f5', text: 'Vad skulle du våga göra om du visste att det inte kunde gå fel?' },
      { id: 'f6', text: 'Vilket land skulle du vilja bo i en tid, och varför just där?' },
      { id: 'f7', text: 'Vad vill du att människor ska minnas dig för?' },
      { id: 'f8', text: 'Vilken dröm från när du var liten har du fortfarande kvar?' },
      { id: 'f9', text: 'Vad vill du lära dig de närmaste åren?' },
      { id: 'f10', text: 'Vilken liten dröm skulle vi kunna göra verklig redan i år?' },
      { id: 'f11', text: 'Hur ser en helt vanlig dag ut i ditt drömliv?' },
      { id: 'f12', text: 'Vad hindrar dig från att börja på en dröm du har?' }
    ] },
    { id: 'framtid-val', titel: 'Framtidsval', typ: 'val', emoji: '🔮', fragor: [
      { id: 'f2', text: 'Drömboende?', a: 'Lägenhet', b: 'Hus' },
      { id: 'f3', text: 'Klimat?', a: 'Varmt året runt', b: 'Fyra årstider' },
      { id: 'f4', text: 'Om vi firar något riktigt stort en dag?', a: 'Stor fest', b: 'Bara vi två' },
      { id: 'f5', text: 'Jobb?', a: 'Samma jobb länge', b: 'Prova nytt ofta' },
      { id: 'f6', text: 'Om tio år?', a: 'Ett lugnt liv', b: 'Fullt av äventyr' },
      { id: 'f8', text: 'När vi är gamla?', a: 'Resa jorden runt', b: 'Stuga och trädgård' },
      { id: 'f9', text: 'Bo nära?', a: 'Familjen', b: 'Havet' },
      { id: 'f10', text: 'Semester varje år?', a: 'Ett nytt land', b: 'Samma favoritställe' },
      { id: 'f11', text: 'Framtiden?', a: 'Planera noga', b: 'Ta det som det kommer' },
      { id: 'f12', text: 'De närmaste åren?', a: 'Bygga ett hem', b: 'Resa runt' }
    ] },
    { id: 'framtid-gissa', titel: 'Gissa min dröm', typ: 'gissa', emoji: '🎯', fragor: [
      { id: 'f1', text: 'Var vill jag helst bo om tio år?', val: ['I en storstad', 'Vid havet', 'På landet', 'Lite här och där'] },
      { id: 'f2', text: 'Vilken drömresa väljer jag?', val: ['Japan', 'Italien', 'Island', 'Maldiverna'] },
      { id: 'f3', text: 'Vad skulle jag göra med ett helt år ledigt?', val: ['Resa', 'Plugga', 'Vila', 'Starta något eget'] },
      { id: 'f4', text: 'Hur många husdjur vill jag ha en dag?', val: ['Inga', 'Ett', 'Två', 'Ett helt zoo'] },
      { id: 'f5', text: 'Vilket drömhem passar mig bäst?', val: ['Modern lägenhet', 'Röd stuga', 'Strandhus', 'Gammal villa'] },
      { id: 'f6', text: 'Vad vill jag helst lära mig?', val: ['Ett nytt språk', 'Ett instrument', 'Att dyka', 'Att måla'] },
      { id: 'f7', text: 'Vilken bil drömmer jag om?', val: ['Sportbil', 'Husbil', 'Elbil', 'Ingen bil alls'] },
      { id: 'f9', text: 'Vad är viktigast för mig i framtiden?', val: ['Familj', 'Frihet', 'Trygghet', 'Äventyr'] },
      { id: 'f10', text: 'Vilket jobb skulle jag ha i ett annat liv?', val: ['Kock', 'Pilot', 'Artist', 'Lärare'] },
      { id: 'f11', text: 'Vad gör jag först om jag vinner en resa?', val: ['Packar direkt', 'Planerar allt', 'Ringer dig'] },
      { id: 'f12', text: 'När vill jag sluta jobba?', val: ['Så tidigt som möjligt', 'Som de flesta', 'Aldrig helt'] }
    ] },
    { id: 'framtid-hem', titel: 'Ett hem tillsammans', typ: 'samtal', emoji: '🏡', fragor: [
      { id: 'f1', text: 'Hur ser ditt drömkök ut?' },
      { id: 'f2', text: 'Vilket rum i ett hem är viktigast för dig?' },
      { id: 'f3', text: 'Vad måste finnas nära där vi bor en dag?' },
      { id: 'f4', text: 'Vilken stil vill du ha hemma: mysigt och fullt, eller luftigt och enkelt?' },
      { id: 'f5', text: 'Vilka traditioner vill du att vi har hemma?' },
      { id: 'f6', text: 'Hur vill du att vi firar högtider i framtiden?' },
      { id: 'f7', text: 'Vad ska hänga på väggarna i ett hem som vi delar?' },
      { id: 'f8', text: 'Hur ser en vanlig söndag ut hemma hos oss om några år?' },
      { id: 'f9', text: 'Vilka sysslor gör du gärna, och vilka vill du helst slippa?' },
      { id: 'f10', text: 'Trädgård, balkong eller ingetdera – vad drömmer du om?' },
      { id: 'f11', text: 'Hur ofta vill du ha gäster hemma?' },
      { id: 'f12', text: 'Vad gör ett hus till ett hem för dig?' }
    ] },
    { id: 'framtid-nasta', titel: 'Nästa gång vi ses', typ: 'samtal', emoji: '✈️', fragor: [
      { id: 'f2', text: 'Vilken mat vill du att vi äter tillsammans nästa gång?' },
      { id: 'f3', text: 'Vad längtar du mest efter när vi är isär?' },
      { id: 'f4', text: 'Vilken plats vill du att vi upptäcker tillsammans nästa gång?' },
      { id: 'f5', text: 'Hur vill du att vi räknar ner dagarna tills vi ses?' },
      { id: 'f7', text: 'Vilken bild vill du att vi tar tillsammans nästa gång?' },
      { id: 'f8', text: 'Vilken vardagssak saknar du mest från när vi är tillsammans?' },
      { id: 'f9', text: 'Vad kan vi göra för att avståndet ska kännas lite mindre?' },
      { id: 'f10', text: 'Vilken liten överraskning skulle göra dig glad när vi ses?' },
      { id: 'f11', text: 'Vad vill du att vi pratar om när vi har all tid i världen?' },
      { id: 'f12', text: 'Vilket minne från förra gången vi sågs tänker du mest på?' }
    ] },
    { id: 'framtid-aldrig', titel: 'Jag har aldrig – planer', typ: 'aldrig', emoji: '🗺️', fragor: [
      { id: 'f1', text: 'Jag har aldrig skrivit en lista med drömmar jag vill uppfylla.' },
      { id: 'f2', text: 'Jag har aldrig gjort en plan för fem år framåt.' },
      { id: 'f3', text: 'Jag har aldrig sparat till samma sak i mer än ett år.' },
      { id: 'f4', text: 'Jag har aldrig sagt upp mig för att följa en dröm.' },
      { id: 'f5', text: 'Jag har aldrig bott i ett annat land.' },
      { id: 'f6', text: 'Jag har aldrig drömt om att bli känd.' },
      { id: 'f7', text: 'Jag har aldrig planerat en resa som sedan inte blev av.' },
      { id: 'f8', text: 'Jag har aldrig skrivit ett brev till mitt framtida jag.' },
      { id: 'f10', text: 'Jag har aldrig dagdrömt om hur vårt hem skulle se ut.' },
      { id: 'f11', text: 'Jag har aldrig bytt bana i livet helt och hållet.' },
      { id: 'f12', text: 'Jag har aldrig lärt mig ett nytt språk som vuxen.' },
      { id: 'f13', text: 'Jag har aldrig sagt ja till något stort utan att tänka efter.' }
    ] }
  ] });
})(window.VL);
