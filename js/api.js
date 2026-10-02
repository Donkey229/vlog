// All kommunikation med Supabase. Sidorna anropar bara VL.api.*.
(function (VL) {
  const sb = supabase.createClient(VL.config.url, VL.config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  VL.sb = sb;
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const uuid = () => crypto.randomUUID();
  const HEAD = 'id,title,kind,start_date,end_date,visibility,cover_media_id,created_by,updated_by,place';
  const CATS = 'memory_categories(slug)';
  const byStart = (a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0);

  async function me() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data ? { ...data, email: session.user.email } : null;
  }
  // Startdagen (dagar tillsammans, sql/20) får bara inloggade läsa – besökare frågar inte efter den. Saknas kolumnen
  // (sql/20 inte körd än) eller nekas den: ett nytt försök utan – sidhuvudet ska aldrig gå sönder av räknaren.
  async function settings() {
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { session = null; }   // okänd inloggning = som besökare
    if (session) {
      const r = await sb.from('settings').select('title,couple_path,social,tillsammans_sedan').eq('id', 1).single();
      if (!r.error) return r.data;
      console.warn('[inställningar] startdagen', r.error);
    }
    return must(await sb.from('settings').select('title,couple_path,social').eq('id', 1).single());
  }
  const updateSettings = async (patch) => must(await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1));

  async function signedUrls(paths, ttl = 3600) {
    const uniq = [...new Set(paths.filter(Boolean))];
    if (!uniq.length) return {};
    const data = must(await sb.storage.from('media').createSignedUrls(uniq, ttl));
    const map = {}; data.forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }
  const headers = async () => must(await sb.from('memories').select(HEAD + ',' + CATS).order('start_date').order('created_at'));

  // Omslagsminiatyr för en lista inlägg (valt omslag, annars första bild/film efter sortering).
  async function withThumbs(rows) {
    if (!rows.length) return rows;
    const media = must(await sb.from('media').select('id,memory_id,thumb_path,kind,sort').in('memory_id', rows.map(r => r.id)).neq('kind', 'audio'));
    const pick = r => media.find(m => m.id === r.cover_media_id) || media.filter(m => m.memory_id === r.id).sort((a, b) => a.sort - b.sort)[0];
    const urls = await signedUrls(rows.map(r => pick(r)?.thumb_path), 86400);
    return rows.map(r => ({ ...r, thumb: urls[pick(r)?.thumb_path] || null }));
  }

  // Minnen som överlappar [fromKey, toKey], i kalenderns format (Task 4).
  async function monthMemories(fromKey, toKey) {
    const rows = must(await sb.from('memories').select(HEAD + ',media!media_memory_id_fkey(kind,day,thumb_path,poster_path,sort)')
      .lte('start_date', toKey).or(`end_date.gte.${fromKey},and(end_date.is.null,start_date.gte.${fromKey})`)
      .order('start_date').order('created_at'));   // samma ordning varje gång: kalenderns val bland lika minnen växlar inte
    const urls = await signedUrls(rows.flatMap(r => r.media.filter(m => m.kind !== 'audio').map(m => m.thumb_path)), 86400);
    return rows.map(r => {
      const days = {};
      [...r.media].filter(m => m.kind !== 'audio').sort((a, b) => a.sort - b.sort).forEach(m => {
        const d = days[m.day] || (days[m.day] = { photos: 0, videos: 0, thumb: null });
        if (m.kind === 'video') d.videos++; else d.photos++;
        if (!d.thumb) d.thumb = urls[m.thumb_path] || null;
      });
      return { id: r.id, title: r.title, kind: r.kind, start_date: r.start_date, end_date: r.end_date, days };
    });
  }
  // Senaste inläggen, valfritt bara en kategori.
  // ilike utan jokertecken = samma plats oavsett versaler
  const exakt = t => String(t).replace(/[\\%_]/g, c => '\\' + c);
  async function recent(n, kat, baraResor = false, plats = null) {
    let q = sb.from('memories').select(HEAD + (kat ? ',memory_categories!inner(slug)' : ',' + CATS));
    if (kat) q = q.eq('memory_categories.slug', kat);
    if (baraResor) q = q.neq('kind', 'dag');
    if (plats) q = q.ilike('place', exakt(plats.trim()));
    const rows = must(await q.order('start_date', { ascending: false }).limit(n));
    return withThumbs(rows);
  }
  const platsRader = async () => must(await sb.from('memories').select('place').neq('place', ''));
  async function search(q) { return withThumbs(must(await sb.rpc('search_memories', { q }))); }
  // Minnen som täcker dagen k (för importen – se VL.dates.valjImportMinne). media behövs för sorteringsordningen.
  // Bara privata: importen lägger aldrig bilder i ett minne som gäster eller alla ser (privat som standard) – då blir det ett
  // eget privat dag-minne, och kalendern visar båda. title: adminsidans Klart-lista och notisen nämner minnet vid namn.
  const importKandidater = async (k) => must(await sb.from('memories').select('id,title,kind,start_date,end_date,cover_media_id,media!media_memory_id_fkey(id)')
    .lte('start_date', k).or(`end_date.gte.${k},and(end_date.is.null,start_date.eq.${k})`).eq('visibility', 'private'));
  async function byIds(ids) {
    if (!ids.length) return [];
    const rows = must(await sb.from('memories').select(HEAD + ',' + CATS).in('id', ids));
    return withThumbs(ids.map(id => rows.find(r => r.id === id)).filter(Boolean));
  }
  async function popular(n) { const top = must(await sb.rpc('popular_memories', { n })); const rows = await byIds(top.map(t => t.id)); return rows.map(r => ({ ...r, likes: top.find(t => t.id === r.id).likes })); }
  // Relaterade: delade kategorier först, fyll på med de närmaste i tid.
  async function related(m, n = 3) {
    const ids = must(await sb.rpc('related_memories', { m: m.id, n })).map(r => r.id);
    if (ids.length < n) {
      const all = await headers();
      const t0 = VL.dates.parseDay(m.start_date).getTime();
      all.filter(h => h.id !== m.id && !ids.includes(h.id))
        .sort((a, b) => Math.abs(VL.dates.parseDay(a.start_date) - t0) - Math.abs(VL.dates.parseDay(b.start_date) - t0))
        .slice(0, n - ids.length).forEach(h => ids.push(h.id));
    }
    return byIds(ids);
  }
  async function memory(id) {
    const { data, error } = await sb.from('memories').select('*, media!media_memory_id_fkey(*), links(*), ' + CATS + ', comments(id,body,author_name,status,created_at,user_id), likes(user_id)').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) { data.media.sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : a.sort - b.sort); data.links.sort((a, b) => a.sort - b.sort); data.comments.sort((a, b) => a.created_at < b.created_at ? -1 : 1); }
    return data;
  }
  const createMemory = async (m) => must(await sb.from('memories').insert(m).select().single());
  const updateMemory = async (id, patch) => must(await sb.from('memories').update(patch).eq('id', id));
  // Minnet (och med det bildraderna) tas bort FÖRST – databasen säger nej om det har någon annans bilder (sql/19), eller om det
  // har bilder som inte finns i listan man sett (m.media; sql/23 ta_bort_minne – t.ex. Emmas nya bilder medan Jocks sida stod
  // öppen) – och filerna sedan, bara om minnet verkligen försvann. Ett nej eller ett avbrott lämnar aldrig trasiga bilder.
  async function deleteMemory(m) {
    const { data: borta, error } = await sb.rpc('ta_bort_minne', { m: m.id, sedda: (m.media || []).map(x => x.id) });
    if (error) throw (/nya_bilder/.test(error.message || '') ? new Error(VL.t('bort.nya_bilder')) : error);
    if (!borta) throw new Error(VL.t('bort.minne_nekad'));
    const paths = (m.media || []).flatMap(x => [x.path, x.thumb_path, x.poster_path]).filter(Boolean);
    // Filer utan rad syns ingenstans: går något fel här är minnet ändå borttaget och resterna kan städas senare.
    for (const omg of VL.urval.omgangar(paths, 1000)) await sb.storage.from('media').remove(omg).catch(() => {});   // lagringens gräns: 1000 sökvägar per anrop
    // Rester i minnets mapp (t.ex. från en avbruten uppladdning) – men inte filer som flyttats till ett annat minne.
    const { data: lista } = await sb.storage.from('media').list('m/' + m.id, { limit: 1000 });
    const rester = (lista || []).map(o => 'm/' + m.id + '/' + o.name);
    if (rester.length) {
      const { data: kvar } = await sb.from('media').select('path,thumb_path,poster_path').like('path', 'm/' + m.id + '/%');
      const anvands = new Set((kvar || []).flatMap(r => [r.path, r.thumb_path, r.poster_path]));
      const bort = rester.filter(x => !anvands.has(x));
      if (bort.length) await sb.storage.from('media').remove(bort);
    }
    await clearCouplePathIf([...paths]);
  }
  // Om parbilden tas bort: nollställ den i stället för att lämna en död länk.
  async function clearCouplePathIf(paths) {
    const s = await settings();
    if (s.couple_path && paths.includes(s.couple_path)) await updateSettings({ couple_path: null });
  }
  // Kopia som mall: text, stil, kategorier och länkar – inte bilder. Alltid privat.
  async function duplicateMemory(m) {
    const kopia = await createMemory({ kind: m.kind, title: (m.title + ' ' + VL.t('meny.kopia')).trim().slice(0, 120), place: m.place || '', story: m.story, style: m.style, start_date: m.start_date, end_date: m.end_date, visibility: 'private' });
    await setCategories(kopia.id, (m.memory_categories || []).map(c => c.slug));
    for (const [i, l] of (m.links || []).entries()) must(await sb.from('links').insert({ memory_id: kopia.id, platform: l.platform, url: l.url, embed_url: l.embed_url, sort: i }));
    return kopia;
  }
  // processed: {kind, full:Blob, thumb:Blob, poster?:Blob, width, height, durationS?, takenAt:Date|null}
  async function uploadMedia(memoryId, p, day, sort) {
    const base = `m/${memoryId}/${uuid()}`;
    const audioExt = p.kind === 'audio' ? ((p.full.name || '').match(/\.(mp3|m4a|aac)$/i)?.[0].toLowerCase() || '.mp3') : null;
    const ext = p.kind === 'video' ? '.mp4' : p.kind === 'audio' ? audioExt : '.jpg';
    const type = p.kind === 'video' ? 'video/mp4' : p.kind === 'audio' ? (p.full.type || (audioExt === '.mp3' ? 'audio/mpeg' : 'audio/mp4')) : 'image/jpeg';
    const path = base + ext, thumb = base + '_t.jpg', poster = p.poster ? base + '_p.jpg' : null;
    const klara = [];
    const up = async (name, blob, t) => { must(await sb.storage.from('media').upload(name, blob, { contentType: t, upsert: false })); klara.push(name); };
    try {
      await up(path, p.full, type);
      await up(thumb, p.thumb, 'image/jpeg');
      if (poster) await up(poster, p.poster, 'image/jpeg');
      const bytes = p.full.size + p.thumb.size + (p.poster ? p.poster.size : 0);
      return must(await sb.from('media').insert({ memory_id: memoryId, kind: p.kind, path, thumb_path: thumb, poster_path: poster, taken_at: p.takenAt ? p.takenAt.toISOString() : null, day, width: p.width, height: p.height, duration_s: p.durationS ?? null, bytes, sort, caption: p.kind === 'audio' ? (p.full.name || '').replace(/\.[^.]+$/, '').slice(0, 500) : '' }).select().single());
    } catch (e) {
      // Svaret kan ha tappats fast raden sparades (mobilnät): finns raden är bilden uppe – den används, filerna får vara kvar
      // (annars en bildrad utan fil, och en dubblett vid nästa försök). Databasen släpper dessutom aldrig en fil som en rad använder (sql/23).
      let sparad = null;
      try { sparad = (await sb.from('media').select().eq('path', path).maybeSingle()).data; } catch (x) { sparad = null; }
      if (sparad) return sparad;
      if (klara.length) await sb.storage.from('media').remove(klara);   // inga föräldralösa filer
      throw e;
    }
  }
  // Raderna först, i omgångar om 50 (id-listan hamnar i URL:en): databasen tar bara bort det jag får – egna bilder, admin
  // allas (sql/19) – och svarar med raderna som faktiskt försvann. Bara deras filer tas sedan bort, så en bild som blev kvar
  // har alltid kvar sin fil och ett avbrott lämnar bara osynliga rester (lagringen släpper dessutom bara filer utan rad).
  // Svarar med antalet borttagna; vid fel får felet .borttagna så att användaren ser hur långt det kom.
  async function removeMediaMany(rows) {
    let borttagna = 0; const klara = [];
    try {
      for (const omg of VL.urval.omgangar(rows, 50)) {
        const borta = must(await sb.from('media').delete().in('id', omg.map(r => r.id)).select('id,path,thumb_path,poster_path')) || [];
        borttagna += borta.length;
        const paths = borta.flatMap(r => [r.path, r.thumb_path, r.poster_path]).filter(Boolean);
        if (paths.length) { klara.push(...paths); await sb.storage.from('media').remove(paths).catch(() => {}); }
        if (borta.length < omg.length) throw new Error(VL.t('urval.nekad'));   // någon annans bild: den och filen blir kvar
      }
    } catch (e) { e.borttagna = borttagna; throw e; }
    finally { if (klara.length) await clearCouplePathIf(klara).catch(() => {}); }
    return borttagna;
  }
  const removeMedia = row => removeMediaMany([row]);
  const setCover = async (memoryId, mediaId) => updateMemory(memoryId, { cover_media_id: mediaId });
  const setMediaDay = async (id, day) => must(await sb.from('media').update({ day }).eq('id', id));
  // Byt datum (och annat i patch) på ett minne utan att någon bild hamnar utanför minnets dagar – då syns den varken i
  // galleriet eller i kalendern. Databasen flyttar bildernas dagar i samma steg (sql/23); det här är reserven tills den är
  // körd, och den utgår från databasens egna rader (färsk start före bytet, färsk bildlista efteråt), aldrig från sidans
  // gamla lista. Bara bilder som ligger utanför flyttas; ett avbrott rättas av nästa sparning. Svarar med antalet flyttade.
  // visade: datumen sidan visade ({ start_date, end_date }). Har någon annan hunnit ändra dem (databasens färska datum skiljer)
  // ändras ingenting och felet har .andrat – annars skrev en sida som stått öppen länge tillbaka sina gamla datum, och
  // databasen flyttade den andras nya bilder till fel dag.
  async function flyttaMinne(id, patch, visade = null) {
    const fore = must(await sb.from('memories').select('start_date,end_date').eq('id', id).single());
    const slutAv = x => (x.end_date && x.end_date !== x.start_date ? x.end_date : null);
    if (visade && (fore.start_date !== visade.start_date || slutAv(fore) !== slutAv(visade))) throw Object.assign(new Error(VL.t('red.andrat')), { andrat: true });
    must(await sb.from('memories').update(patch).eq('id', id));
    const start = patch.start_date || fore.start_date;
    const slut = 'end_date' in patch ? patch.end_date : fore.end_date;
    const sista = slut || start;
    const utanfor = (must(await sb.from('media').select('id,day').eq('memory_id', id)) || []).filter(x => x.day < start || x.day > sista);
    for (const x of utanfor) await setMediaDay(x.id, VL.dates.remapDay(x.day, fore.start_date, start, slut));
    return utanfor.length;
  }
  // Slå ihop i databasen (allt eller inget): bilder, länkar, kommentarer, gilla, kategorier och text flyttas till target.
  // Filerna ligger kvar under sina gamla sökvägar – skrivrätten följer bildens rad (can_write_object).
  // Databasen (sql/24) ger målet den strängaste synligheten, utökar dess datum och säger nej (inget ändrat) om något kom till
  // i en källa under tiden eller ett minne inte finns längre – de två nejen blir begripliga besked.
  async function mergeInto(target, sources) {
    const { error } = await sb.rpc('merge_memories', { target: target.id, sources: sources.map(x => x.id) });
    if (!error) return null;
    const m = String(error.message || '');
    throw (/ihop_andrat/.test(m) ? new Error(VL.t('ihop.fel_andrat')) : /ihop_saknas/.test(m) ? new Error(VL.t('ihop.fel_saknas')) : error);
  }
  const addLink = async (memoryId, p, sort = 0) => must(await sb.from('links').insert({ memory_id: memoryId, platform: p.platform, url: p.url, embed_url: p.embedUrl, sort }).select().single());
  const removeLink = async (id) => must(await sb.from('links').delete().eq('id', id));
  // kategorier
  const categories = async () => must(await sb.from('categories').select('*').order('sort'));
  async function setCategories(memoryId, slugs) {
    must(await sb.from('memory_categories').delete().eq('memory_id', memoryId));
    if (slugs.length) must(await sb.from('memory_categories').insert(slugs.map(slug => ({ memory_id: memoryId, slug }))));
  }
  const addCategory = async (c) => must(await sb.from('categories').insert(c));
  const catName = (c) => c ? (c[VL.lang()] || c.sv) : '';
  // gilla och kommentarer
  async function toggleLike(memoryId, liked) {
    if (liked) must(await sb.from('likes').insert({ memory_id: memoryId }));
    else must(await sb.from('likes').delete().eq('memory_id', memoryId).eq('user_id', (await sb.auth.getUser()).data.user.id));
  }
  // Ingen .select(): väntande kommentarer får inte läsas av den som skrev dem anonymt.
  async function addComment(memoryId, body, authorName, approved = false) {
    must(await sb.from('comments').insert({ memory_id: memoryId, body, author_name: authorName, ...(approved ? { status: 'approved' } : {}) }));
  }
  const approveComment = async (id) => must(await sb.from('comments').update({ status: 'approved' }).eq('id', id));
  const deleteComment = async (id) => must(await sb.from('comments').delete().eq('id', id));
  const pendingComments = async () => must(await sb.from('comments').select('id,body,author_name,user_id,created_at,memory_id,memories(title,start_date)').eq('status', 'pending').order('created_at'));
  // Om oss
  const about = async () => must(await sb.from('about_page').select('*').eq('id', 1).maybeSingle());
  const updateAbout = async (patch) => must(await sb.from('about_page').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1));
  async function uploadAboutPhoto(blob, oldPath) {
    const name = `om/${uuid()}.jpg`;
    must(await sb.storage.from('media').upload(name, blob, { contentType: 'image/jpeg', upsert: false }));
    await updateAbout({ photo_path: name });
    if (oldPath) await sb.storage.from('media').remove([oldPath]);
    return name;
  }
  // profiler, lagring, logg, admin
  async function profiles() { const { data } = await sb.from('profiles').select('id,display_name,avatar_path,role'); const map = {}; (data || []).forEach(p => map[p.id] = p); return map; }
  async function updateProfile(patch) { const { data: { user } } = await sb.auth.getUser(); must(await sb.from('profiles').update(patch).eq('id', user.id)); }
  async function uploadAvatar(blob) { const { data: { user } } = await sb.auth.getUser(); const name = `avatars/${user.id}.jpg`; must(await sb.storage.from('media').upload(name, blob, { contentType: 'image/jpeg', upsert: true })); await updateProfile({ avatar_path: name }); return name; }
  async function storageUsedMB() { const rows = must(await sb.from('media').select('bytes')); return Math.round(rows.reduce((s, r) => s + Number(r.bytes || 0), 0) / 1048576); }
  // för aktivitetsloggen: bildrader (miniatyr, typ, minne) och minnenas namn, per id
  async function mediaById(ids) {
    const map = {}; if (!ids.length) return map;
    must(await sb.from('media').select('id,kind,thumb_path,memory_id').in('id', ids)).forEach(r => { map[r.id] = r; });
    return map;
  }
  async function minnesTitlar(ids) {
    const map = {}; if (!ids.length) return map;
    must(await sb.from('memories').select('id,title,start_date,end_date').in('id', ids)).forEach(r => { map[r.id] = r.title || VL.dates.formatRange(r.start_date, r.end_date); });
    return map;
  }
  // notisklockan: senaste notiserna, antal olästa, markera som läst (bara egna – databasen ser till det)
  const notiser = async (n = 20) => must(await sb.from('notiser').select('id,text,url,created_at,read_at').order('created_at', { ascending: false }).limit(n));
  async function olastaNotiser() { const { count, error } = await sb.from('notiser').select('id', { count: 'exact', head: true }).is('read_at', null); if (error) throw error; return count || 0; }
  const lasNotis = async id => must(await sb.from('notiser').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null));
  const lasNotiserMedUrl = async url => must(await sb.from('notiser').update({ read_at: new Date().toISOString() }).eq('url', url).is('read_at', null));
  const lasAllaNotiser = async () => must(await sb.from('notiser').update({ read_at: new Date().toISOString() }).is('read_at', null));
  // träffar – med träffens tidszon (sql/27), så att sidan visar samma tid som påminnelsen. Finns kolumnen inte än (sql/27
  // inte körd): ett nytt försök utan zon (42703/PGRST204 om just tidszon – ett annat fel döljs aldrig).
  const TRAFF = 'id,title,day,at_time,city,venue,address,note';
  const utanZon = e => /tidszon/i.test(String((e && e.message) || '')) && /42703|PGRST204/.test(String((e && e.code) || '') + ' ' + String((e && e.message) || ''));
  async function medZon(fraga) {
    const r = await fraga(TRAFF + ',tidszon');
    if (r.error && utanZon(r.error)) return must(await fraga(TRAFF));
    return must(r);
  }
  const traffar = async () => medZon(k => sb.from('traffar').select(k + ',created_by,updated_by').order('day'));
  const nyTraff = async t => medZon(k => sb.from('traffar').insert(t).select(k).single());
  const andraTraff = async (id, t) => medZon(k => sb.from('traffar').update(t).eq('id', id).select(k).single());
  const taBortTraff = async id => must(await sb.from('traffar').delete().eq('id', id));
  const activity = async (n = 50) => must(await sb.from('activity').select('*').order('at', { ascending: false }).limit(n));
  async function admin(action, payload = {}) {
    const { data, error } = await sb.functions.invoke('admin-users', { body: { action, site: VL.config.site, ...payload } });
    if (error) { let msg = error.message; try { msg = (await error.context.json()).fel || msg; } catch (e) {} throw new Error(msg); }
    return data;
  }
  // push-notiser: spara/ta bort den här enheten, och be servern skicka en notis till de andra
  const sparaPrenumeration = async (sub, enhet) => must(await sb.rpc('spara_prenumeration', { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth, p_enhet: enhet || '' }));
  const taBortPrenumeration = async endpoint => must(await sb.from('push_subscriptions').delete().eq('endpoint', endpoint));
  // "Logga ut från alla enheter": alla mina enheters rader (databasen låter bara var och en ta bort sina egna)
  const taBortAllaPrenumerationer = async userId => must(await sb.from('push_subscriptions').delete().eq('user_id', userId));
  // text = { sv, en, th } – notis-funktionen väljer mottagarens språk (testnotisen: en färdig text)
  // Hjärtat: reaktioner mellan Jock och Emma (databasen släpper bara igenom avsändaren och mottagaren).
  const minId = async () => { const { data: { session } } = await sb.auth.getSession(); return session ? session.user.id : null; };
  const REAKTION = 'id,from_id,to_id,emoji,text,created_at,read_at';
  const reaktioner = async (n = 50) => must(await sb.from('reaktioner').select(REAKTION).order('created_at', { ascending: false }).limit(n));
  const skickaReaktion = async ({ to_id, emoji, text }) => must(await sb.from('reaktioner').insert({ to_id, emoji, text }).select(REAKTION).single());
  async function lasReaktioner() { const id = await minId(); if (id) must(await sb.from('reaktioner').update({ read_at: new Date().toISOString() }).eq('to_id', id).is('read_at', null)); }
  async function olastaReaktioner() {
    const id = await minId(); if (!id) return 0;
    const { count, error } = await sb.from('reaktioner').select('id', { count: 'exact', head: true }).eq('to_id', id).is('read_at', null);
    if (error) throw error; return count || 0;
  }
  const notisReaktion = async id => { const { data, error } = await sb.functions.invoke('notis', { body: { reaktion: true, id } }); if (error) throw error; return data; };
  // Eget foto bakom stora hjärtat (fast tills man byter) och fotona att välja bland (även för profilbilden).
  const bakgrund = async () => { const r = must(await sb.from('hjarta_bakgrund').select('path').maybeSingle()); return r ? r.path : null; };
  const sattBakgrund = async path => must(await sb.from('hjarta_bakgrund').upsert({ path }, { onConflict: 'user_id' }));
  async function taBortBakgrund() { const id = await minId(); if (id) must(await sb.from('hjarta_bakgrund').delete().eq('user_id', id)); }
  const foton = async (n = 300) => must(await sb.from('media').select('id,path,thumb_path,day').eq('kind', 'photo').order('day', { ascending: false }).limit(n));
  const notis = async (text, url, test = false, endpoint = null) => { const { data, error } = await sb.functions.invoke('notis', { body: { text, url, test, endpoint } }); if (error) throw error; return data; };
  VL.api = { me, settings, updateSettings, signedUrls, headers, withThumbs, monthMemories, recent, platsRader, search, popular, related, memory,
    createMemory, updateMemory, deleteMemory, duplicateMemory, importKandidater, uploadMedia, removeMedia, removeMediaMany, setCover, setMediaDay, flyttaMinne, mergeInto, addLink, removeLink,
    categories, setCategories, addCategory, catName, toggleLike, addComment, approveComment, deleteComment, pendingComments,
    about, updateAbout, uploadAboutPhoto, profiles, updateProfile, uploadAvatar, storageUsedMB, activity, notiser, olastaNotiser, lasNotis, lasNotiserMedUrl, lasAllaNotiser, traffar, nyTraff, andraTraff, taBortTraff, mediaById, minnesTitlar, admin, byStart, sparaPrenumeration, taBortPrenumeration, taBortAllaPrenumerationer, notis,
    reaktioner, skickaReaktion, lasReaktioner, olastaReaktioner, notisReaktion, bakgrund, sattBakgrund, taBortBakgrund, foton };
  // Frågor & spel (sql/22): status = antal egna och den andras svar per paket (bara siffror); svaren i ett paket = mina +
  // den andras på frågor jag själv svarat på (databasen släpper inte fram fler); spara = upsert på (user_id, paket, fraga),
  // där user_id alltid sätts av databasen (auth.uid()) och aldrig skickas härifrån.
  const SPELSVAR = 'user_id,fraga,svar,gissning,andrad';
  Object.assign(VL.api, {
    spelStatus: async () => must(await sb.rpc('spel_status')) || [],
    spelSvar: async paket => must(await sb.from('spel_svar').select(SPELSVAR).eq('paket', paket)) || [],
    sparaSpelSvar: async (paket, fraga, svar, gissning = null) =>
      must(await sb.from('spel_svar').upsert({ paket, fraga, svar, gissning }, { onConflict: 'user_id,paket,fraga' }).select(SPELSVAR).single()),
  });
  // iPhone-widgeten (Scriptable): ny personlig nyckel i klartext EN gång – databasen sparar bara dess sha256; den gamla slutar gälla (sql/21)
  VL.api.nyWidgetnyckel = async () => must(await sb.rpc('ny_widgetnyckel'));
  // stäng av widgeten: tar bort ens egen nyckel (bara den egna) – widgeten på alla telefoner slutar visa något (sql/21 stang_widget)
  VL.api.stangWidget = async () => must(await sb.rpc('stang_widget'));

  // ==== A: utseende och säker sparning (sql/26) ====
  // Funktionen eller tabellen finns inte (sql/26 inte körd än, eller PostgREST har inte läst om sitt schema) – då kan appen
  // använda sin reserv i stället för att visa ett fel. Andra fel (nekad, krock, ogiltigt värde) är riktiga fel.
  const saknasI26 = e => !!e && (['PGRST202', 'PGRST205', '42883', '42P01'].includes(e.code) || /does not exist/i.test(String(e.message || '')));
  const saknasFel = (vad, e) => Object.assign(new Error(vad + ' finns inte i databasen än (sql/26)'), { saknas: true, orsak: e });

  // Bakgrunden per person (sql/26 utseende): antal bilder, hur synliga (procent) och vilka. Databasen ger bara den egna raden
  // och gäller på alla enheter. Utan inloggning, utan rad, vid fel (tabellen saknas, nätfel) eller ett okänt värde: standard –
  // kastar aldrig, så att sidan aldrig går sönder av bakgrunden. Saknas tabellen (sql/26 inte körd) har standardvärdet
  // saknas: true, och sparaUtseende kastar då ett fel med .saknas – så att Bakgrund kan visa "Kommer snart".
  const UTSEENDE_ANTAL = [0, 1, 6, 12, 24, 40], UTSEENDE_URVAL = ['alla', 'veckan', 'gillade'], UTSEENDE_FALT = ['bg_antal', 'bg_synlighet', 'bg_urval'];
  const utseendeStandard = () => ({ bg_antal: 12, bg_synlighet: 12, bg_urval: 'alla' });
  VL.api.utseende = async () => {
    const std = utseendeStandard();
    try {
      const id = await minId();
      if (!id) return std;
      const { data, error } = await sb.from('utseende').select(UTSEENDE_FALT.join(',')).eq('user_id', id).maybeSingle();
      if (error) { console.warn('[utseende]', error); return saknasI26(error) ? { ...std, saknas: true } : std; }   // saknas: sql/26 inte körd – Bakgrund visar "Kommer snart"
      if (!data) return std;
      return {
        bg_antal: UTSEENDE_ANTAL.includes(data.bg_antal) ? data.bg_antal : std.bg_antal,
        bg_synlighet: Number.isInteger(data.bg_synlighet) && data.bg_synlighet >= 0 && data.bg_synlighet <= 45 ? data.bg_synlighet : std.bg_synlighet,
        bg_urval: UTSEENDE_URVAL.includes(data.bg_urval) ? data.bg_urval : std.bg_urval,
      };
    } catch (e) { console.warn('[utseende]', e); return std; }
  };
  // Sparar den egna raden (skapas första gången). Bara de tre kolumnerna skickas – vems raden är och när den ändrades sätter
  // databasen. Svarar med den sparade raden; kastar vid fel (t.ex. ogiltigt värde eller ingen inloggning).
  VL.api.sparaUtseende = async (patch) => {
    const rad = {};
    UTSEENDE_FALT.forEach(k => { if (patch && Object.prototype.hasOwnProperty.call(patch, k)) rad[k] = patch[k]; });
    if (!Object.keys(rad).length) return VL.api.utseende();
    const { data, error } = await sb.from('utseende').upsert(rad, { onConflict: 'user_id' }).select(UTSEENDE_FALT.join(',')).single();
    if (error) throw saknasI26(error) ? saknasFel('utseende', error) : error;
    return data;
  };

  // Säker sparning av ett minne (sql/26 spara_minne): sett = värdena när Ändra öppnades, precis som de kom från databasen
  // (för datum: både start_date och end_date); nytt = bara de ändrade fälten (title, story, place, kind, visibility, style,
  // start_date, end_date). Databasen sparar fält för fält och aldrig över någon annans ändring – svar
  // { sparade: [fält], krockar: { fält: databasens värde }, updated_at }. Saknas funktionen (sql/26 inte körd): fel med
  // .saknas = true, så att appen kan använda sin reserv. Andra fel kastas som de är ('saknas' = minnet finns inte eller syns
  // inte, 'nekad', 'okänt fält: x', 'ogiltigt värde: x', databasens egna villkor).
  VL.api.sparaMinne = async (id, sett, nytt) => {
    // sett/nytt skickas alltid (ett saknat argument hade sett ut som "funktionen saknas" och fått appen att ta reserven)
    const { data, error } = await sb.rpc('spara_minne', { m: id == null ? null : id, sett: sett || {}, nytt: nytt || {} });
    if (error) {
      if (saknasI26(error)) throw saknasFel('spara_minne', error);
      throw error;
    }
    return { sparade: (data && data.sparade) || [], krockar: (data && data.krockar) || {}, updated_at: data ? data.updated_at : null };
  };
  // Versionerna av ett minne (sql/26 minne_versioner): högst 50, nyast först. Bara Jock och Emma kan läsa dem.
  VL.api.minnesVersioner = async (id) => {
    const { data, error } = await sb.from('minne_versioner').select('id,memory_id,falt,gammalt,nytt,andrad_av,andrad')
      .eq('memory_id', id).order('andrad', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (error) {
      if (saknasI26(error)) throw saknasFel('minne_versioner', error);
      throw error;
    }
    return data || [];
  };
  // ==== slut A ====

  // ==== B: frågor, plan och påminnelser (sql/27) ====
  // Dagens frågor, Inför träffen och Er plan. Frågetexterna läses ur databasen (fragepott) först när de behövs – de finns
  // aldrig i publicerad JavaScript. Lottning, lås och vad den andra får se avgörs i databasen; appen sparar bara egna svar
  // och skickar aldrig user_id (databasen sätter vem). Finns sql/27 inte än (funktion eller tabell saknas) får felet
  // .saknas = true, så att sidan kan visa "kommer snart" i stället för ett fel.
  {
    const SAKNAS = /PGRST202|PGRST205|42P01|42883|does not exist|could not find the (function|table)/i;
    const fragaFel = e => {
      const f = e instanceof Error ? e : new Error(String((e && e.message) || e || 'okänt fel'));
      if (e && e.code && !f.code) f.code = e.code;
      if (SAKNAS.test(String((e && e.code) || '') + ' ' + String((e && e.message) || ''))) f.saknas = true;
      return f;
    };
    const kor = async fn => { let r; try { r = await fn(); } catch (e) { throw fragaFel(e); } if (r && r.error) throw fragaFel(r.error); return r ? r.data : null; };
    const rpc = (f, args) => kor(() => (args ? sb.rpc(f, args) : sb.rpc(f)));
    // samma standardvärden som tabellen fraga_installning (sql/27) – Sex 18+ och klockan av tills man själv slår på,
    // "18+ även på morgonen" på (Jocks beslut 2026-10-02: när BÅDA slagit på 18+ gäller det morgon och kväll)
    const FRAGA_STANDARD = { tidszon: 'Europe/Stockholm', morgon: '08:00', kvall: '21:00', kategorier: ['karlek', 'vardag', 'relation'],
      vuxen: false, vuxen_morgon: true, niva: 1, visa_klocka: false, tyst_natt: true, paus_till: null,
      notiser: { dagens: true, din_tur: true, traff: true }, samtycke_sett: null };
    const INST_FALT = ['tidszon', 'morgon', 'kvall', 'kategorier', 'vuxen', 'vuxen_morgon', 'niva', 'visa_klocka', 'tyst_natt', 'paus_till', 'notiser', 'samtycke_sett'];
    const INST = INST_FALT.join(',') + ',andrad';
    const bara = (o, falt) => Object.fromEntries(falt.filter(k => o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined).map(k => [k, o[k]]));
    const hhmm = t => (typeof t === 'string' ? t.slice(0, 5) : t);
    const medStandard = r => { const x = { ...FRAGA_STANDARD, ...(r || {}) }; x.morgon = hhmm(x.morgon); x.kvall = hhmm(x.kvall); return x; };

    Object.assign(VL.api, {
      FRAGA_STANDARD,
      // egen inställning (bara egen rad syns); utan rad: standardvärdena
      fragaInstallning: async () => medStandard(await kor(() => sb.from('fraga_installning').select(INST).maybeSingle())),
      sparaFragaInstallning: async patch => medStandard(await kor(() => sb.from('fraga_installning').upsert(bara(patch, INST_FALT), { onConflict: 'user_id' }).select(INST).single())),
      // {kategorier, vuxen, vuxen_morgon, niva, pausat_18, partner_tid} – aldrig den andras zon, nivå eller lista
      fragaGemensamt: () => rpc('fraga_gemensamt'),
      // {antal_tillsammans, tillfallen:[{dag, tillfalle, oppen, kl, kan_vara_vuxen, mitt, andra_klar}]} – ingen fråga, ingen kategori
      dagensIdag: () => rpc('dagens_idag'),
      // {fraga_id, kategori, vuxen, niva, typ} eller null (inte öppet än, ingen fråga, eller 18+ som inte längre gäller)
      dagensVisa: (dag, t) => rpc('dagens_visa', { p_dag: dag, p_tillfalle: t }),
      // {id: {text, alternativ, typ}} på mitt språk, svenska som reserv
      frageText: async ids => {
        const lista = [...new Set((ids || []).filter(Boolean))];
        if (!lista.length) return {};
        const lang = VL.lang ? VL.lang() : 'sv', egen = lang !== 'sv' && ['en', 'th'].includes(lang) ? 'text_' + lang : null;
        const rader = await kor(() => sb.from('fragepott').select('id,typ,alternativ,text_sv' + (egen ? ',' + egen : '')).in('id', lista)) || [];
        // alternativ på mitt språk: nyckel_en/nyckel_th (t.ex. nivåfrågans etiketter_en) ersätter nyckeln när den finns och
        // har samma form – annars svenskan. Nivåernas ord finns därför bara i databasen, aldrig i publicerad JavaScript.
        const sprak = egen ? lang : null;
        const pa = alt => {
          const a = alt && typeof alt === 'object' ? alt : {}, ut = {};
          for (const [k, v] of Object.entries(a)) {
            if (/_(en|th)$/.test(k)) continue;
            const o = sprak ? a[k + '_' + sprak] : undefined;
            ut[k] = (Array.isArray(v) ? Array.isArray(o) && o.length === v.length : typeof o === 'string' && o.trim()) ? o : v;
          }
          return ut;
        };
        const ut = {};
        for (const r of rader) ut[r.id] = { text: (egen && r[egen] && String(r[egen]).trim()) || r.text_sv, alternativ: pa(r.alternativ), typ: r.typ };
        return ut;
      },
      // eget svar på dagens fråga; fraga_id behövs inte (databasen fyller i dagens fråga) men skickas om sidan har det,
      // så att ett svar på en fråga som hunnit bytas aldrig hamnar på den nya. Var svaret ligger: skala → varde (1–5),
      // val → val (det valda alternativet, högst 120 tecken), fritext → text (högst 1000). hoppat skickas alltid
      // (upsert ändrar bara kolumnerna som skickas – utan det stod en tidigare överhoppning kvar och svaret tömdes).
      // När ni båda svarat är svaret låst; på en 18+-fråga får det bara ändras nedåt (värdet sänkas, ja → kanske → nej, texten tömmas).
      dagensSvara: async (dag, t, svar = {}) => kor(() => sb.from('dagens_svar')
        .upsert({ dag, tillfalle: t, ...bara(svar, ['fraga_id', 'varde', 'val', 'text', 'hoppat']), hoppat: svar.hoppat === true }, { onConflict: 'user_id,dag,tillfalle' })
        .select('dag,tillfalle,fraga_id,varde,val,text,hoppat,tillbaka,andrad').single()),
      dagensMittSvar: async (dag, t) => kor(() => sb.from('dagens_svar').select('dag,tillfalle,fraga_id,varde,val,text,hoppat,tillbaka,andrad').eq('dag', dag).eq('tillfalle', t).maybeSingle()),
      // {klar:false} eller {klar:true, svar:[{user_id, namn, varde, val, text}]} – först när båda svarat (aldrig efter hoppa över)
      dagensSvaren: (dag, t) => rpc('dagens_svaren', { p_dag: dag, p_tillfalle: t }),
      // träffen: [{fraga_id, del, omgang, ordning, typ}], framsteg per del, egna svar, och Er plan (bara det båda valt)
      traffFragor: id => rpc('traff_fragor', { p_traff: id }),
      traffStatus: id => rpc('traff_status', { p_traff: id }),
      // träffens svar: jkn → val ('ja' | 'kanske' | 'nej'), skala → varde (1–5), val-frågor och fritext → text (det valda
      // alternativet eller egen text, högst 500). När delen är öppen (Er plan) får svaren bara ändras nedåt; gränser och
      // stoppord får alltid ändras. Ett tömt svar räknas som överhoppat.
      traffSvara: async (id, fragaId, svar = {}) => kor(() => sb.from('traff_svar')
        .upsert({ traff_id: id, fraga_id: fragaId, ...bara(svar, ['val', 'varde', 'text', 'hoppat']), hoppat: svar.hoppat === true }, { onConflict: 'user_id,traff_id,fraga_id' })
        .select('traff_id,fraga_id,val,varde,text,hoppat,andrad').single()),
      traffMinaSvar: async id => (await kor(() => sb.from('traff_svar').select('traff_id,fraga_id,val,varde,text,hoppat,andrad').eq('traff_id', id))) || [],
      erPlan: id => rpc('er_plan', { p_traff: id }),
      // Är ett paket i Frågor & spel intimt (18+)? Paketen i en kategori med vuxen === true (site/js/spel/*.js) och alla
      // Dagens frågor (paket-id dag-…). Vet sidan inte (frågedatan saknas, eller paketet finns inte längre) räknas det som
      // intimt – säkerhetskopian lägger det då hellre i den egna filen än i data.json.
      arIntimtPaket: paketId => {
        const p = String(paketId || '');
        if (!p || /^dag-/.test(p)) return true;
        const kat = VL.spelData && Array.isArray(VL.spelData.kategorier) ? VL.spelData.kategorier : null;
        if (!kat || !kat.length) return true;
        for (const k of kat) if ((k.paket || []).some(x => x && x.id === p)) return k.vuxen === true;
        return true;
      },
    });
  }
  // ==== slut B ====

  // ==== D: Hem och Vi två ====
  // Hem (omdesignen 2026-10, §6.1). Bara läsning – Hem ändrar aldrig något. Databasens regler (RLS) avgör vad som syns.
  // antal minnen som den inloggade får se: bara siffran (head-count, inga rader hämtas)
  VL.api.antalMinnen = async () => { const { count, error } = await sb.from('memories').select('id', { count: 'exact', head: true }); if (error) throw error; return count || 0; };
  // Höjdpunkter: minnenas namn, typ och datum – updated_at visar "nytt sedan sist" (jämförs bara i telefonen, sparas aldrig i databasen)
  VL.api.hemMinnen = async () => must(await sb.from('memories').select('id,title,kind,start_date,end_date,cover_media_id,updated_at').order('start_date', { ascending: false }));
  // Den här veckan: det som laddats upp de senaste 7 dagarna (högst n), nyast först, med tumnagel
  VL.api.veckan = async (n = 9) => {
    const sedan = new Date(Date.now() - 7 * 86400000).toISOString();
    const rader = must(await sb.from('media').select('id,memory_id,kind,thumb_path,created_at').neq('kind', 'audio').gte('created_at', sedan).order('created_at', { ascending: false }).limit(n)) || [];
    const urls = await signedUrls(rader.map(r => r.thumb_path), 86400);
    return rader.map(r => ({ ...r, thumb: urls[r.thumb_path] || null }));
  };
  // Händelser i Vi två-bladet: omslaget till minnena som notiserna pekar på ({ id: tumnagel })
  VL.api.minnesOmslag = async ids => {
    if (!ids.length) return {};
    const rader = await withThumbs(must(await sb.from('memories').select('id,cover_media_id').in('id', ids)) || []);
    return Object.fromEntries(rader.map(r => [r.id, r.thumb]));
  };
  // ==== slut D ====

  // ==== E: Ändra minne och tidslinjen ====
  // Tidslinjen (Väg och Lista): minnen nyast först med omslag och antal bilder och filmer. typ = 'resa' eller 'utflykt';
  // plats = samma plats oavsett versaler (som recent); kat = en kategori. Läser bara – inget skrivs.
  async function tidslinje(n, { typ = null, plats = null, kat = null } = {}) {
    let q = sb.from('memories').select(HEAD + (kat ? ',memory_categories!inner(slug)' : ',' + CATS));
    if (kat) q = q.eq('memory_categories.slug', kat);
    if (typ) q = q.eq('kind', typ);
    if (plats) q = q.ilike('place', exakt(plats.trim()));
    const rows = must(await q.order('start_date', { ascending: false }).limit(n));
    if (!rows.length) return rows;
    // alla filrader (för antalet): servern ger högst 1000 rader per svar – en resa kan ha 50 filer, så sida för sida
    const media = (await Promise.all(VL.urval.omgangar(rows.map(r => r.id), 50).map(async ids => {
      const ut = [];
      for (let fran = 0; ; fran += 1000) {
        const sida = must(await sb.from('media').select('id,memory_id,thumb_path,kind,sort').in('memory_id', ids).order('id').range(fran, fran + 999));
        ut.push(...sida);
        if (sida.length < 1000) return ut;
      }
    }))).flat();
    const per = {};
    media.forEach(m => { (per[m.memory_id] = per[m.memory_id] || []).push(m); });
    const pick = r => { const egna = (per[r.id] || []).filter(m => m.kind !== 'audio'); return egna.find(m => m.id === r.cover_media_id) || egna.sort((a, b) => a.sort - b.sort)[0]; };
    const urls = await signedUrls(rows.map(r => pick(r)?.thumb_path), 86400);
    return rows.map(r => ({ ...r, thumb: urls[pick(r)?.thumb_path] || null,
      antal: { bilder: (per[r.id] || []).filter(m => m.kind === 'photo').length, filmer: (per[r.id] || []).filter(m => m.kind === 'video').length } }));
  }
  // Platsbladet ("Era platser"): minnen med plats, nyast först, och omslaget på de två senaste per plats. Ingen position används.
  async function platsMinnen() {
    const rows = must(await sb.from('memories').select('id,place,start_date,cover_media_id').neq('place', '').order('start_date', { ascending: false }));
    const antal = {}, tva = [];
    rows.forEach(r => { const k = String(r.place || '').trim().toLocaleLowerCase('sv'); if (k && (antal[k] = (antal[k] || 0) + 1) <= 2) tva.push(r); });
    const med = tva.length ? await withThumbs(tva).catch(() => tva) : [];
    const tumme = {}; med.forEach(r => { tumme[r.id] = r.thumb || null; });
    return rows.map(r => ({ id: r.id, place: r.place, start_date: r.start_date, thumb: tumme[r.id] || null }));
  }
  Object.assign(VL.api, { tidslinje, platsMinnen });
  // ==== slut E ====

  // ==== F: navigering och inställningar ====
  // Bilderna bakom sidan (Bakgrund, spec §6.5): foton ur minnen som tittaren får se (RLS gäller som vanligt), slumpade bland de
  // 200 senaste. urval 'veckan' = upplagda de senaste 7 dagarna, 'gillade' = ur minnen jag gillat, 'alla' = alla. publika: bara
  // minnen som alla får se (läget "Bara publika bilder"). stor: ETT fullstort foto (antal 1) i stället för tumnaglar.
  // Bara läsning – inget skrivs. Inga gillade/publika minnen ger en tom lista utan att fråga efter bilder.
  VL.api.bakgrundBilder = async ({ urval = 'alla', antal = 12, publika = false, stor = false } = {}) => {
    let minnen = null;   // null = alla minnen tittaren ser
    if (urval === 'gillade') {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return [];
      minnen = (must(await sb.from('likes').select('memory_id').eq('user_id', user.id)) || []).map(r => r.memory_id);
    }
    if (publika) {
      const pub = (must(await sb.from('memories').select('id').eq('visibility', 'public')) || []).map(r => r.id);
      minnen = minnen ? minnen.filter(id => pub.includes(id)) : pub;
    }
    if (minnen && !minnen.length) return [];
    let q = sb.from('media').select('path,thumb_path,memory_id').eq('kind', 'photo');
    if (minnen) q = q.in('memory_id', minnen.slice(0, 300));
    if (urval === 'veckan') q = q.gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString());
    const rader = must(await q.order('created_at', { ascending: false }).limit(200)) || [];
    const blandat = [...rader];
    for (let i = blandat.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [blandat[i], blandat[j]] = [blandat[j], blandat[i]]; }
    const valda = blandat.slice(0, Math.max(1, Math.min(40, antal)));
    const fil = r => (stor ? r.path : r.thumb_path);
    const urls = await signedUrls(valda.map(fil), 86400);
    return valda.map(r => urls[fil(r)]).filter(Boolean);
  };
  // ==== slut F ====
})(window.VL);
