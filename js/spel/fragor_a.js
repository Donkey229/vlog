// Frågor & spel – innehåll del 1: Startfrågor, Relationen, Kärlek & intimitet (18+) och Värderingar.
// Egna frågor skrivna för vloggen. Id:n är stabila – svaren sparas per paket-id + fråge-id, så byt aldrig ett id
// på en fråga som redan finns (lägg hellre till en ny med nästa lediga id).
// Gissa-frågorna är skrivna i jag-form (som i del 2): båda svarar för sig själva och gissar sedan den andras svar.
(function (VL) {
  VL.spelData = VL.spelData || { kategorier: [] };

  // ---------- Startfrågor ----------
  VL.spelData.kategorier.push({ id: 'start', namn: 'Startfrågor', emoji: '💜', farg: 'lila', vuxen: false, paket: [
    { id: 'start-forsta', titel: 'Första intrycket', typ: 'samtal', emoji: '👀', fragor: [
      { id: 'f1', text: 'Vad tänkte du första gången du såg mig?' },
      { id: 'f2', text: 'Vilken detalj hos mig lade du märke till först?' },
      { id: 'f3', text: 'När förstod du att du ville träffa mig igen?' },
      { id: 'f4', text: 'Vad var du nervös för innan vi sågs första gången?' },
      { id: 'f5', text: 'Vilket av våra första samtal minns du bäst – och varför just det?' },
      { id: 'f6', text: 'Fanns det något hos mig som överraskade dig i början?' },
      { id: 'f7', text: 'Vad berättade du för dina vänner om mig i början?' },
      { id: 'f8', text: 'Vilket var det första meddelandet från mig som fick dig att le?' },
      { id: 'f9', text: 'Om du fick uppleva en enda stund från vår första tid igen, vilken skulle det bli?' },
      { id: 'f10', text: 'Vad trodde du om mig då som visade sig stämma?' },
      { id: 'f11', text: 'Vad trodde du om mig då som visade sig vara helt fel?' },
      { id: 'f12', text: 'Vilken låt, doft eller plats får dig att tänka på vår början?' }
    ] },
    { id: 'start-vardag', titel: 'Små vardagsfrågor', typ: 'samtal', emoji: '☕', fragor: [
      { id: 'f1', text: 'Vad är det bästa som hänt dig i dag, hur litet det än är?' },
      { id: 'f2', text: 'Vad äter du helst till frukost en ledig dag?' },
      { id: 'f3', text: 'Vilken liten vana har du som jag kanske inte känner till?' },
      { id: 'f4', text: 'Vad gör dig på gott humör en grå måndag?' },
      { id: 'f5', text: 'Vilket ljud tycker du om att somna till?' },
      { id: 'f6', text: 'Vad har du alltid med dig när du går hemifrån?' },
      { id: 'f7', text: 'Vad är det första du gör när du vaknar?' },
      { id: 'f8', text: 'Vilken mat tröstar dig bäst?' },
      { id: 'f9', text: 'Vad skulle du göra med en helt oplanerad ledig eftermiddag?' },
      { id: 'f10', text: 'Vilken sak hemma hos dig betyder mest för dig?' },
      { id: 'f11', text: 'Vad har du skrattat mest åt den här veckan?' },
      { id: 'f12', text: 'Vilken liten sak får dig att känna dig omtyckt en helt vanlig dag?' }
    ] },
    { id: 'start-val', titel: 'Snabba val', typ: 'val', emoji: '⚡', fragor: [
      { id: 'f1', text: 'Helst?', a: 'Strand', b: 'Fjäll' },
      { id: 'f2', text: 'Vilken är du?', a: 'Morgonpigg', b: 'Nattuggla' },
      { id: 'f3', text: 'På morgonen?', a: 'Kaffe', b: 'Te' },
      { id: 'f4', text: 'En ledig kväll?', a: 'Film hemma', b: 'Ut och äta' },
      { id: 'f5', text: 'På resan?', a: 'Planera allt', b: 'Ta det som det kommer' },
      { id: 'f6', text: 'Snacks?', a: 'Sött', b: 'Salt' },
      { id: 'f7', text: 'Husdjur?', a: 'Hund', b: 'Katt' },
      { id: 'f8', text: 'Väder?', a: 'Sol och värme', b: 'Snö och mys' },
      { id: 'f9', text: 'Hälsning från din partner?', a: 'Röstmeddelande', b: 'Skrivet meddelande' },
      { id: 'f10', text: 'Musik i bilen?', a: 'Sjunga med högt', b: 'Lyssna i lugn och ro' },
      { id: 'f11', text: 'Semester?', a: 'Storstad', b: 'Liten by' },
      { id: 'f12', text: 'Helgmorgon?', a: 'Sovmorgon', b: 'Tidig promenad' },
      { id: 'f13', text: 'Present?', a: 'En sak', b: 'En upplevelse' },
      { id: 'f14', text: 'Fotot?', a: 'Selfie ihop', b: 'Någon annan tar det' },
      { id: 'f15', text: 'Middag?', a: 'Laga själv', b: 'Beställa hem' }
    ] },
    { id: 'start-aldrig', titel: 'Jag har aldrig – vardag', typ: 'aldrig', emoji: '🙈', fragor: [
      { id: 'f1', text: 'Jag har aldrig somnat på bio.' },
      { id: 'f2', text: 'Jag har aldrig ätit glass till middag.' },
      { id: 'f3', text: 'Jag har aldrig sjungit högt i duschen.' },
      { id: 'f4', text: 'Jag har aldrig gått vilse i min egen stad.' },
      { id: 'f5', text: 'Jag har aldrig skickat ett meddelande till fel person.' },
      { id: 'f6', text: 'Jag har aldrig låtsats ha sett en film som jag inte har sett.' },
      { id: 'f7', text: 'Jag har aldrig glömt bort en väns födelsedag.' },
      { id: 'f8', text: 'Jag har aldrig dansat ensam i köket.' },
      { id: 'f9', text: 'Jag har aldrig ätit något som ramlat på golvet.' },
      { id: 'f10', text: 'Jag har aldrig somnat med lampan tänd.' },
      { id: 'f11', text: 'Jag har aldrig pratat med ett djur som om det förstod allt.' },
      { id: 'f12', text: 'Jag har aldrig missat ett flyg, ett tåg eller en buss.' }
    ] },
    { id: 'start-gissa', titel: 'Gissa min favorit', typ: 'gissa', emoji: '🎯', fragor: [
      { id: 'f1', text: 'Vilken mat väljer jag helst en fredag?', val: ['Pizza', 'Sushi', 'Tacos', 'Hemlagat'] },
      { id: 'f2', text: 'Vilken årstid tycker jag mest om?', val: ['Vår', 'Sommar', 'Höst', 'Vinter'] },
      { id: 'f3', text: 'Vad dricker jag helst på morgonen?', val: ['Kaffe', 'Te', 'Juice', 'Vatten'] },
      { id: 'f4', text: 'Var vill jag helst vakna en ledig dag?', val: ['Hemma i sängen', 'Vid havet', 'I en stuga', 'På hotell'] },
      { id: 'f5', text: 'Vilken sorts film väljer jag helst?', val: ['Komedi', 'Romantik', 'Action', 'Skräck'] },
      { id: 'f6', text: 'Hur vill jag helst fira min födelsedag?', val: ['Stor fest', 'Liten middag', 'Resa bort', 'Helt lugnt'] },
      { id: 'f7', text: 'Vad gör jag helst en regnig söndag?', val: ['Sover länge', 'Ser serier', 'Bakar', 'Går ut ändå'] },
      { id: 'f8', text: 'Vad tar jag först ur godisskålen?', val: ['Choklad', 'Sura godisar', 'Lakrits', 'Chips'] },
      { id: 'f9', text: 'Vilket djur skulle jag helst ha hemma?', val: ['Hund', 'Katt', 'Kanin', 'Inget djur'] },
      { id: 'f10', text: 'Hur tar jag helst en promenad?', val: ['Med musik', 'I tystnad', 'I telefon', 'Med sällskap'] },
      { id: 'f11', text: 'Vilken glass väljer jag?', val: ['Choklad', 'Vanilj', 'Jordgubb', 'Sorbet'] },
      { id: 'f12', text: 'Vad gör jag helst första timmen av en ledig dag?', val: ['Sover', 'Äter frukost', 'Tränar', 'Scrollar i mobilen'] }
    ] }
  ] });

  // ---------- Relationen ----------
  VL.spelData.kategorier.push({ id: 'relation', namn: 'Relationen', emoji: '💞', farg: 'rosa', vuxen: false, paket: [
    { id: 'relation-oss', titel: 'Vi två', typ: 'samtal', emoji: '💞', fragor: [
      { id: 'f1', text: 'Vad är det bästa med oss två, tycker du?' },
      { id: 'f2', text: 'Vilken stund tillsammans tänker du oftast tillbaka på?' },
      { id: 'f3', text: 'Vad har du lärt dig om dig själv sedan vi blev ett par?' },
      { id: 'f4', text: 'När känner du dig mest älskad av mig?' },
      { id: 'f5', text: 'Vad tycker du att vi är riktigt bra på tillsammans?' },
      { id: 'f6', text: 'Vilket ord eller skämt är bara vårt?' },
      { id: 'f7', text: 'Vad vill du att vi gör mer av?' },
      { id: 'f8', text: 'Finns det något du vill att vi gör mindre av?' },
      { id: 'f9', text: 'Vilken av våra vanor – stor eller liten – tycker du mest om?' },
      { id: 'f10', text: 'Om vår historia var en film, vad skulle den heta?' },
      { id: 'f11', text: 'Vad är du mest stolt över att vi har klarat tillsammans?' },
      { id: 'f12', text: 'Vad vill du att vi ska minnas av just den här tiden i vårt liv?' }
    ] },
    { id: 'relation-isar', titel: 'När vi är isär', typ: 'samtal', emoji: '🌙', fragor: [
      { id: 'f1', text: 'Vad saknar du mest när vi inte är på samma plats?' },
      { id: 'f2', text: 'Vilket slags meddelande från mig blir du gladast av när vi är långt ifrån varandra?' },
      { id: 'f3', text: 'Vad gör du när längtan blir som störst?' },
      { id: 'f4', text: 'Hur vill du helst att vi säger god natt när vi är isär?' },
      { id: 'f5', text: 'Vilken sak från mig skulle du vilja ha hos dig just nu?' },
      { id: 'f6', text: 'Vad ser du mest fram emot nästa gång vi ses?' },
      { id: 'f7', text: 'Vad är det första du vill göra när vi ses igen?' },
      { id: 'f8', text: 'Hur märker jag bäst att du har en tung dag, fast vi inte ses?' },
      { id: 'f9', text: 'Vilken vardagssak skulle du vilja att vi gör samtidigt, fast vi är på olika platser?' },
      { id: 'f10', text: 'Vad hjälper dig att känna dig nära mig trots avståndet?' },
      { id: 'f11', text: 'Vad kan jag göra för att väntan till nästa gång ska kännas kortare?' },
      { id: 'f12', text: 'Vad har avståndet lärt dig om oss?' }
    ] },
    { id: 'relation-karlek', titel: 'Så visar vi kärlek', typ: 'val', emoji: '💌', fragor: [
      { id: 'f1', text: 'Vad värmer mest?', a: 'Ett långt samtal', b: 'En lång kram' },
      { id: 'f2', text: 'Efter en tung dag?', a: 'Få vara ifred en stund', b: 'Bli tröstad direkt' },
      { id: 'f3', text: '"Jag älskar dig" – helst?', a: 'Sagt högt', b: 'Skrivet' },
      { id: 'f4', text: 'Överraskningar?', a: 'Små och ofta', b: 'Stora och sällan' },
      { id: 'f5', text: 'När vi blir osams?', a: 'Prata ut direkt', b: 'Lugna ner sig först' },
      { id: 'f6', text: 'God natt på avstånd?', a: 'Videosamtal', b: 'Ett långt meddelande' },
      { id: 'f7', text: 'Present från din partner?', a: 'Något praktiskt', b: 'Något personligt' },
      { id: 'f8', text: 'Bästa komplimangen?', a: 'Om hur du ser ut', b: 'Om hur du är' },
      { id: 'f9', text: 'Dejten?', a: 'Planerad i förväg', b: 'Helt spontan' },
      { id: 'f10', text: 'Tid tillsammans?', a: 'Prova något nytt', b: 'Göra det vi älskar' },
      { id: 'f11', text: 'När du behöver hjälp?', a: 'Att någon gör det åt dig', b: 'Att någon gör det med dig' },
      { id: 'f12', text: 'Kärlek syns bäst i?', a: 'Ord', b: 'Handling' },
      { id: 'f13', text: 'En helg ihop?', a: 'Bara vi två', b: 'Med vänner' },
      { id: 'f14', text: 'När längtan kommer?', a: 'Ringa direkt', b: 'Spara det till kvällens samtal' }
    ] },
    { id: 'relation-aldrig', titel: 'Jag har aldrig – vi två', typ: 'aldrig', emoji: '🙊', fragor: [
      { id: 'f1', text: 'Jag har aldrig läst ett av dina meddelanden flera gånger i rad.' },
      { id: 'f2', text: 'Jag har aldrig sparat en skärmbild på något du skrivit.' },
      { id: 'f3', text: 'Jag har aldrig låtsats sova för att slippa gå upp först.' },
      { id: 'f4', text: 'Jag har aldrig ätit upp något som var tänkt till dig.' },
      { id: 'f5', text: 'Jag har aldrig skrattat åt ett av dina skämt utan att förstå det.' },
      { id: 'f6', text: 'Jag har aldrig berättat om dig för en helt främmande människa.' },
      { id: 'f7', text: 'Jag har aldrig haft på mig något av dina kläder.' },
      { id: 'f8', text: 'Jag har aldrig räknat dagarna tills vi ses igen.' },
      { id: 'f9', text: 'Jag har aldrig varit svartsjuk utan anledning.' },
      { id: 'f10', text: 'Jag har aldrig ångrat något jag sagt när vi varit osams.' },
      { id: 'f11', text: 'Jag har aldrig tittat på gamla bilder på oss när jag saknat dig.' },
      { id: 'f12', text: 'Jag har aldrig fortsatt en diskussion fast jag visste att jag hade fel.' }
    ] },
    { id: 'relation-gissa', titel: 'Hur väl känner du mig?', typ: 'gissa', emoji: '🧩', fragor: [
      { id: 'f1', text: 'Vad gör jag först när jag blir ledsen?', val: ['Pratar med någon', 'Vill vara ensam', 'Går ut', 'Sover'] },
      { id: 'f2', text: 'Hur vill jag helst bli tröstad?', val: ['En kram', 'Prata om det', 'Tänka på annat', 'Få vara ifred'] },
      { id: 'f3', text: 'Vad blir jag gladast av att få?', val: ['Ett brev', 'En present', 'Tid ihop', 'Ett samtal'] },
      { id: 'f4', text: 'Vad stressar mig mest?', val: ['Tidspress', 'Osämja', 'Pengar', 'Det okända'] },
      { id: 'f5', text: 'Hur är jag när jag är hungrig?', val: ['Som vanligt', 'Tyst', 'Lite grinig', 'Pratar bara om mat'] },
      { id: 'f6', text: 'Hur tar jag helst emot kärlek?', val: ['Fina ord', 'Beröring', 'Tid ihop', 'Omtanke i handling'] },
      { id: 'f7', text: 'Hur reder jag helst ut en konflikt?', val: ['Pratar direkt', 'Väntar en stund', 'Skriver', 'Kramas först'] },
      { id: 'f8', text: 'När är det bäst att prata allvar med mig?', val: ['Morgon', 'Mitt på dagen', 'Kväll', 'Sent på natten'] },
      { id: 'f9', text: 'Vad är jag mest nervös för inför en träff?', val: ['Packningen', 'Resan', 'Utseendet', 'Inget alls'] },
      { id: 'f10', text: 'Hur länge kan jag vara sur?', val: ['Några minuter', 'Någon timme', 'En dag', 'Längre'] },
      { id: 'f11', text: 'Vad vill jag helst göra första kvällen när vi ses igen?', val: ['Äta ute', 'Laga mat ihop', 'Mysa hemma', 'Hitta på något'] },
      { id: 'f12', text: 'Vilket slags minne av oss pratar jag helst om?', val: ['Första träffen', 'En resa', 'En vanlig dag', 'Ett internskämt'] }
    ] },
    { id: 'relation-skaver', titel: 'När det skaver', typ: 'samtal', emoji: '🌧️', fragor: [
      { id: 'f1', text: 'Hur märker jag bäst att något är fel, fast du säger att allt är bra?' },
      { id: 'f2', text: 'Vad behöver du från mig när vi har varit osams?' },
      { id: 'f3', text: 'Finns det något ord eller tonfall som gör dig extra ledsen?' },
      { id: 'f4', text: 'Hur vill du att vi ber om förlåtelse till varandra?' },
      { id: 'f5', text: 'Vad gör det lättare för dig att ta upp något jobbigt?' },
      { id: 'f6', text: 'Vilken av våra osämjor har lärt oss mest, tror du?' },
      { id: 'f7', text: 'Hur kan vi pausa ett gräl utan att någon känner sig lämnad?' },
      { id: 'f8', text: 'Vad önskar du att jag frågade dig om oftare?' },
      { id: 'f9', text: 'Finns det något du burit på som du vill säga nu, i lugn och ro?' },
      { id: 'f10', text: 'Vad får dig att känna dig trygg med mig även när vi tycker olika?' },
      { id: 'f11', text: 'Hur gör vi när ett meddelande missförstås och vi inte kan ses och prata?' },
      { id: 'f12', text: 'Vad kan vi lova varandra inför nästa gång det skaver?' }
    ] }
  ] });

  // ---------- Kärlek & intimitet (18+) ----------
  // Varsamt skrivet: närhet, romantik, önskningar, gränser och samtycke – inget grovt eller explicit.
  VL.spelData.kategorier.push({ id: 'intim', namn: 'Kärlek & intimitet', emoji: '🔥', farg: 'vinrod', vuxen: true, paket: [
    { id: 'intim-narhet', titel: 'Närhet', typ: 'samtal', emoji: '🕯️', fragor: [
      { id: 'f1', text: 'Vilken sorts beröring gör dig mest lugn?' },
      { id: 'f2', text: 'När känner du dig som allra mest nära mig?' },
      { id: 'f3', text: 'Vad får dig att känna dig vacker eller attraktiv?' },
      { id: 'f4', text: 'Vilken av våra kyssar minns du bäst?' },
      { id: 'f5', text: 'Vad är det mysigaste vi gör när vi bara ligger nära varandra?' },
      { id: 'f6', text: 'Hur vill du helst bli väckt av mig?' },
      { id: 'f7', text: 'Vad uppskattar du mest med hur jag rör vid dig?' },
      { id: 'f8', text: 'Vilken liten beröring i vardagen gör dig glad – en hand på ryggen, i håret, något annat?' },
      { id: 'f9', text: 'Hur visar du att du vill vara nära, utan att säga det?' },
      { id: 'f10', text: 'Vad får dig att slappna av helt med mig?' },
      { id: 'f11', text: 'När har du känt starkast att du längtar efter mig?' },
      { id: 'f12', text: 'Vad betyder intimitet för dig – utöver det fysiska?' }
    ] },
    { id: 'intim-romantik', titel: 'Romantik', typ: 'val', emoji: '🌹', fragor: [
      { id: 'f1', text: 'Kyssen?', a: 'Lång och långsam', b: 'Snabb och lekfull' },
      { id: 'f2', text: 'Romantisk kväll?', a: 'Middag med levande ljus', b: 'Filt under stjärnorna' },
      { id: 'f3', text: 'Flörta?', a: 'Med ord', b: 'Med blickar' },
      { id: 'f4', text: 'Mys?', a: 'Under täcket', b: 'I badkaret' },
      { id: 'f5', text: 'Kärleksbrev?', a: 'Handskrivet', b: 'Ett långt meddelande' },
      { id: 'f6', text: 'Bli väckt?', a: 'Med en kyss', b: 'Med frukost på sängen' },
      { id: 'f7', text: 'Dansa?', a: 'Tryckare i köket', b: 'Ute på dansgolvet' },
      { id: 'f8', text: 'Somna?', a: 'Som skedar', b: 'Ansikte mot ansikte' },
      { id: 'f9', text: 'Romantik?', a: 'Spontan', b: 'Planerad' },
      { id: 'f10', text: 'Klädsel på dejten?', a: 'Uppklädd', b: 'Mjukisbyxor' },
      { id: 'f11', text: 'Ljuset?', a: 'Levande ljus', b: 'Dagsljus' },
      { id: 'f12', text: 'Komplimangen?', a: 'Viskad i örat', b: 'Sagd inför andra' },
      { id: 'f13', text: 'Musiken?', a: 'Lugn och mjuk', b: 'Ingen musik alls' }
    ] },
    { id: 'intim-onskan', titel: 'Önskningar & gränser', typ: 'samtal', emoji: '🤍', fragor: [
      { id: 'f1', text: 'Vad behöver du för att känna dig trygg när vi är nära varandra?' },
      { id: 'f2', text: 'Hur vill du att vi frågar varandra om vi har lust?' },
      { id: 'f3', text: 'Hur säger vi enklast "inte nu" utan att den andra känner sig avvisad?' },
      { id: 'f4', text: 'Finns det något du gärna vill att vi provar tillsammans någon gång?' },
      { id: 'f5', text: 'Finns det något du vet att du inte vill – som jag borde känna till?' },
      { id: 'f6', text: 'Vad gör det lätt för dig att prata om närhet med mig?' },
      { id: 'f7', text: 'Finns det något om vår närhet som du velat säga men inte vågat?' },
      { id: 'f8', text: 'Hur vill du att vi gör när den ena har mer lust än den andra?' },
      { id: 'f9', text: 'Vad gör en kväll riktigt romantisk för dig, från början till slut?' },
      { id: 'f10', text: 'Hur vill du att vi tar hand om varandra efteråt?' },
      { id: 'f11', text: 'Hur ser vi till att båda alltid känner sig fria att ändra sig, när som helst?' },
      { id: 'f12', text: 'Vilken önskan har du för vår närhet framåt?' }
    ] },
    { id: 'intim-aldrig', titel: 'Jag har aldrig – romantiskt', typ: 'aldrig', emoji: '😳', fragor: [
      { id: 'f1', text: 'Jag har aldrig rodnat av ett meddelande från dig.' },
      { id: 'f2', text: 'Jag har aldrig skickat ett flirtigt meddelande vid helt fel tillfälle.' },
      { id: 'f3', text: 'Jag har aldrig dagdrömt om dig mitt på dagen när jag borde gjort något annat.' },
      { id: 'f4', text: 'Jag har aldrig kysst någon i regnet.' },
      { id: 'f5', text: 'Jag har aldrig skrivit ett kärleksbrev för hand.' },
      { id: 'f6', text: 'Jag har aldrig sovit i en av dina tröjor för att den doftar som du.' },
      { id: 'f7', text: 'Jag har aldrig planerat en romantisk överraskning som gick snett.' },
      { id: 'f8', text: 'Jag har aldrig blivit kär vid första ögonkastet.' },
      { id: 'f9', text: 'Jag har aldrig dansat tryckare utan musik.' },
      { id: 'f10', text: 'Jag har aldrig kysst någon när klockan slog tolv på nyårsafton.' },
      { id: 'f11', text: 'Jag har aldrig tänkt på vår första kyss när jag skulle somna.' },
      { id: 'f12', text: 'Jag har aldrig sparat ett romantiskt meddelande för att läsa det igen senare.' }
    ] },
    { id: 'intim-gissa', titel: 'Gissa det romantiska', typ: 'gissa', emoji: '💋', fragor: [
      { id: 'f1', text: 'Vad tycker jag är mest romantiskt?', val: ['Ett brev', 'En resa', 'En middag', 'En lång kram'] },
      { id: 'f2', text: 'När på dygnet känner jag mig mest kärleksfull?', val: ['Morgon', 'Eftermiddag', 'Kväll', 'Mitt i natten'] },
      { id: 'f3', text: 'Vilken sorts kyss tycker jag mest om?', val: ['Mjuk', 'Lekfull', 'Lång', 'Överraskande'] },
      { id: 'f4', text: 'Vad tänder gnistan mest hos mig?', val: ['En blick', 'Ett ord', 'En beröring', 'En doft'] },
      { id: 'f5', text: 'Var vill jag helst ha en romantisk helg?', val: ['Vid havet', 'I en stuga', 'I en storstad', 'Hemma'] },
      { id: 'f6', text: 'Vad gör mig mest pirrig?', val: ['Ett meddelande', 'En röst', 'Ett foto', 'En kram'] },
      { id: 'f7', text: 'Hur flörtar jag helst?', val: ['Med blickar', 'Med skämt', 'Med ord', 'Med beröring'] },
      { id: 'f8', text: 'Vilken doft gör mig mest kär?', val: ['Parfym', 'Nytvättade lakan', 'Ren hud', 'Morgonkaffe'] },
      { id: 'f9', text: 'Vad vill jag helst göra en romantisk kväll hemma?', val: ['Laga mat ihop', 'Ta ett bad', 'Se film tätt ihop', 'Dansa'] },
      { id: 'f10', text: 'Hur visar jag helst att jag är kär?', val: ['Med ord', 'Med en blick', 'Med en kram', 'Med en lapp'] },
      { id: 'f11', text: 'Vilken musik tycker jag passar bäst en kärlekskväll?', val: ['Jazz', 'Pop', 'Akustiskt', 'Tystnad'] },
      { id: 'f12', text: 'Vad tycker jag är mest attraktivt?', val: ['Självförtroende', 'Humor', 'Omtanke', 'Ett fint leende'] }
    ] },
    { id: 'intim-langtan', titel: 'Längtan på avstånd', typ: 'samtal', emoji: '💌', fragor: [
      { id: 'f1', text: 'Vad tänker du på när du saknar min närhet som mest?' },
      { id: 'f2', text: 'Vilket slags meddelande från mig får dig att längta allra mest?' },
      { id: 'f3', text: 'Hur kan vi flörta med varandra när vi är långt ifrån varandra?' },
      { id: 'f4', text: 'Vad vill du att jag viskar till dig nästa gång vi ses?' },
      { id: 'f5', text: 'Vad saknar du mest med att somna bredvid mig?' },
      { id: 'f6', text: 'Vilken bild på oss tittar du på när du längtar?' },
      { id: 'f7', text: 'Hur vill du att vår första kväll ska bli när vi ses igen?' },
      { id: 'f8', text: 'Vad är det mest romantiska jag skulle kunna göra för dig på avstånd?' },
      { id: 'f9', text: 'Vad känns bra att dela med varandra i telefon och chatt – och vad vill du hellre spara tills vi ses?' },
      { id: 'f10', text: 'Vilket ljud, vilken doft eller sak får dig att tänka på mig när jag inte är där?' },
      { id: 'f11', text: 'Hur känns det i kroppen precis innan vi ses efter lång tid?' },
      { id: 'f12', text: 'Vad vill du säga till mig just nu, som du annars brukar spara tills vi ses?' }
    ] }
  ] });

  // ---------- Värderingar ----------
  VL.spelData.kategorier.push({ id: 'varden', namn: 'Värderingar', emoji: '🤝', farg: 'guld', vuxen: false, paket: [
    { id: 'varden-viktigt', titel: 'Det som är viktigt', typ: 'samtal', emoji: '🧭', fragor: [
      { id: 'f1', text: 'Vilka tre ord beskriver hur du vill leva ditt liv?' },
      { id: 'f2', text: 'Vad betyder ärlighet för dig – finns det vita lögner som är okej?' },
      { id: 'f3', text: 'Vad betyder lojalitet i en relation för dig?' },
      { id: 'f4', text: 'Vilket beslut i ditt liv är du mest stolt över?' },
      { id: 'f5', text: 'Vem har format dina värderingar mest, och hur?' },
      { id: 'f6', text: 'Vad är du inte beredd att kompromissa med?' },
      { id: 'f7', text: 'Vad tycker du att en god vän alltid ska ställa upp med?' },
      { id: 'f8', text: 'Hur viktigt är det för dig att vi tycker lika i stora frågor?' },
      { id: 'f9', text: 'Vad betyder ett lyckat liv för dig?' },
      { id: 'f10', text: 'Hur hoppas du att andra beskriver dig när du inte är i rummet?' },
      { id: 'f11', text: 'Vilken orättvisa i världen berör dig mest?' },
      { id: 'f12', text: 'Har du ändrat uppfattning om något viktigt de senaste åren – i så fall vad?' }
    ] },
    { id: 'varden-vagval', titel: 'Vägval', typ: 'val', emoji: '⚖️', fragor: [
      { id: 'f1', text: 'Viktigast i en relation?', a: 'Trygghet', b: 'Spänning' },
      { id: 'f2', text: 'Pengar över?', a: 'Spara', b: 'Unna oss något' },
      { id: 'f3', text: 'Ärlighet?', a: 'Rak och direkt', b: 'Varsam och mjuk' },
      { id: 'f4', text: 'Jobbet?', a: 'Trygg lön', b: 'Göra det man brinner för' },
      { id: 'f5', text: 'Högtider?', a: 'Med familjen', b: 'Bara vi två' },
      { id: 'f6', text: 'Hemmet?', a: 'Ordning och reda', b: 'Lite stökigt men mysigt' },
      { id: 'f7', text: 'Stora beslut?', a: 'Med huvudet', b: 'Med hjärtat' },
      { id: 'f8', text: 'Bo?', a: 'I stan', b: 'På landet' },
      { id: 'f9', text: 'Vänner?', a: 'Många bekanta', b: 'Några få nära' },
      { id: 'f10', text: 'Tiden?', a: 'Planera framåt', b: 'Leva i nuet' },
      { id: 'f11', text: 'När något stör dig?', a: 'Säga det direkt', b: 'Välja sina strider' },
      { id: 'f12', text: 'Traditioner?', a: 'Hålla fast vid gamla', b: 'Skapa egna' },
      { id: 'f13', text: 'Hjälpa andra?', a: 'Ge av sin tid', b: 'Ge pengar' },
      { id: 'f14', text: 'En ledig dag?', a: 'Göra något nyttigt', b: 'Göra ingenting alls' }
    ] },
    { id: 'varden-rotter', titel: 'Familj & rötter', typ: 'samtal', emoji: '🏡', fragor: [
      { id: 'f1', text: 'Vilken tradition från din uppväxt vill du att vi tar med oss?' },
      { id: 'f2', text: 'Vad har du lärt dig av din familj som du vill föra vidare?' },
      { id: 'f3', text: 'Finns det något från din uppväxt som du vill göra annorlunda?' },
      { id: 'f4', text: 'Hur mycket plats vill du att våra familjer ska ta i vårt liv?' },
      { id: 'f5', text: 'Hur vill du att vi firar högtider – med din familj, med min eller på vårt eget sätt?' },
      { id: 'f6', text: 'Vad betyder "hemma" för dig?' },
      { id: 'f7', text: 'Vilken maträtt smakar barndom för dig?' },
      { id: 'f8', text: 'Hur gör vi när våra familjer har olika förväntningar på oss?' },
      { id: 'f9', text: 'Vem i din familj eller släkt vill du att jag lär känna bättre?' },
      { id: 'f10', text: 'Vad har platsen där du växte upp gett dig som du är tacksam för?' },
      { id: 'f11', text: 'Vad vill du att vi två ska stå för som familj?' },
      { id: 'f12', text: 'Vilken regel hemma hos dig som barn tycker du fortfarande är klok?' }
    ] },
    { id: 'varden-aldrig', titel: 'Jag har aldrig – ärligt talat', typ: 'aldrig', emoji: '🤞', fragor: [
      { id: 'f1', text: 'Jag har aldrig hittat på en ursäkt för att slippa en fest.' },
      { id: 'f2', text: 'Jag har aldrig sagt till när jag fått för mycket växel tillbaka.' },
      { id: 'f3', text: 'Jag har aldrig bytt åsikt efter en bra diskussion.' },
      { id: 'f4', text: 'Jag har aldrig gett bort något jag själv ville ha kvar.' },
      { id: 'f5', text: 'Jag har aldrig bett om förlåtelse fast jag tyckte att jag hade rätt.' },
      { id: 'f6', text: 'Jag har aldrig hållit ett nyårslöfte ett helt år.' },
      { id: 'f7', text: 'Jag har aldrig sagt ifrån när någon blev illa behandlad.' },
      { id: 'f8', text: 'Jag har aldrig låtsats tycka om en present.' },
      { id: 'f9', text: 'Jag har aldrig hjälpt en främling utan att någon såg det.' },
      { id: 'f10', text: 'Jag har aldrig brutit ett löfte till en vän.' },
      { id: 'f11', text: 'Jag har aldrig berättat något som jag lovat att hålla hemligt.' },
      { id: 'f12', text: 'Jag har aldrig ångrat att jag var ärlig.' }
    ] },
    { id: 'varden-gissa', titel: 'Gissa vad jag värdesätter', typ: 'gissa', emoji: '💭', fragor: [
      { id: 'f1', text: 'Vad är viktigast för mig i en relation?', val: ['Trygghet', 'Humor', 'Ärlighet', 'Passion'] },
      { id: 'f2', text: 'Vad ger mig mest glädje i vardagen?', val: ['Människor', 'Naturen', 'Arbetet', 'Lugn och ro'] },
      { id: 'f3', text: 'Vad skulle jag helst vilja ha mer av i livet?', val: ['Tid', 'Pengar', 'Äventyr', 'Lugn'] },
      { id: 'f4', text: 'Vad betyder framgång mest för mig?', val: ['Familj', 'Karriär', 'Frihet', 'Hälsa'] },
      { id: 'f5', text: 'Vilken egenskap beundrar jag mest hos andra?', val: ['Mod', 'Snällhet', 'Humor', 'Klokhet'] },
      { id: 'f6', text: 'Vad har jag svårast att förlåta?', val: ['Lögner', 'Svek', 'Elakhet', 'Slarv'] },
      { id: 'f7', text: 'Hur fattar jag stora beslut?', val: ['Snabbt', 'Efter lång tid', 'Frågar andra', 'Följer magen'] },
      { id: 'f8', text: 'Vad skulle jag göra med en extra ledig dag varje vecka?', val: ['Vara med familjen', 'Vila', 'En hobby', 'Hjälpa andra'] },
      { id: 'f9', text: 'Vad är jag mest tacksam för just nu?', val: ['Hälsan', 'Kärleken', 'Vännerna', 'Familjen'] },
      { id: 'f10', text: 'Vilket värde vill jag helst att vi står för som par?', val: ['Ärlighet', 'Generositet', 'Glädje', 'Respekt'] },
      { id: 'f11', text: 'Vad väger tyngst när jag väljer jobb?', val: ['Lönen', 'Kollegorna', 'Meningen', 'Friheten'] },
      { id: 'f12', text: 'Vilken sorts hjälp ger jag helst?', val: ['Lyssnar', 'Ger råd', 'Hjälper till praktiskt', 'Får andra att skratta'] }
    ] }
  ] });
})(window.VL);
