// All kommunikation med Supabase. Sidorna anropar bara VL.api.*.
(function (VL) {
  const sb = supabase.createClient(VL.config.url, VL.config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  VL.sb = sb;
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const uuid = () => crypto.randomUUID();
  const HEAD = 'id,title,kind,start_date,end_date,visibility,cover_media_id,created_by';
  const CATS = 'memory_categories(slug)';
  const byStart = (a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0);

  async function me() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data ? { ...data, email: session.user.email } : null;
  }
  const settings = async () => must(await sb.from('settings').select('title,couple_path,social').eq('id', 1).single());
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
      .lte('start_date', toKey).or(`end_date.gte.${fromKey},and(end_date.is.null,start_date.gte.${fromKey})`));
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
  async function recent(n, kat, baraResor = false) {
    let q = sb.from('memories').select(HEAD + (kat ? ',memory_categories!inner(slug)' : ',' + CATS));
    if (kat) q = q.eq('memory_categories.slug', kat);
    if (baraResor) q = q.neq('kind', 'dag');
    const rows = must(await q.order('start_date', { ascending: false }).limit(n));
    return withThumbs(rows);
  }
  async function search(q) { return withThumbs(must(await sb.rpc('search_memories', { q }))); }
  // Minnen som täcker dagen k (för importen – se VL.dates.valjImportMinne). media behövs för sorteringsordningen.
  const importKandidater = async (k) => must(await sb.from('memories').select('id,kind,start_date,end_date,cover_media_id,media!media_memory_id_fkey(id)')
    .lte('start_date', k).or(`end_date.gte.${k},and(end_date.is.null,start_date.eq.${k})`));
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
  async function deleteMemory(m) {
    const paths = m.media.flatMap(x => [x.path, x.thumb_path, x.poster_path]).filter(Boolean);
    if (paths.length) must(await sb.storage.from('media').remove(paths));
    must(await sb.from('memories').delete().eq('id', m.id));
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
    const kopia = await createMemory({ kind: m.kind, title: (m.title + ' ' + VL.t('meny.kopia')).trim().slice(0, 120), story: m.story, style: m.style, start_date: m.start_date, end_date: m.end_date, visibility: 'private' });
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
      if (klara.length) await sb.storage.from('media').remove(klara);   // inga föräldralösa filer
      throw e;
    }
  }
  async function removeMedia(row) {
    const paths = [row.path, row.thumb_path, row.poster_path].filter(Boolean);
    must(await sb.storage.from('media').remove(paths));
    must(await sb.from('media').delete().eq('id', row.id));
    await clearCouplePathIf(paths);
  }
  const setCover = async (memoryId, mediaId) => updateMemory(memoryId, { cover_media_id: mediaId });
  const setMediaDay = async (id, day) => must(await sb.from('media').update({ day }).eq('id', id));
  // Slå ihop i databasen (allt eller inget): bilder, länkar, kommentarer, gilla, kategorier och text flyttas till target.
  // Filerna ligger kvar under sina gamla sökvägar – skrivrätten följer bildens rad (can_write_object).
  const mergeInto = async (target, sources) => must(await sb.rpc('merge_memories', { target: target.id, sources: sources.map(x => x.id) }));
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
  async function profiles() { const { data } = await sb.from('profiles').select('id,display_name,avatar_path'); const map = {}; (data || []).forEach(p => map[p.id] = p); return map; }
  async function updateProfile(patch) { const { data: { user } } = await sb.auth.getUser(); must(await sb.from('profiles').update(patch).eq('id', user.id)); }
  async function uploadAvatar(blob) { const { data: { user } } = await sb.auth.getUser(); const name = `avatars/${user.id}.jpg`; must(await sb.storage.from('media').upload(name, blob, { contentType: 'image/jpeg', upsert: true })); await updateProfile({ avatar_path: name }); return name; }
  async function storageUsedMB() { const rows = must(await sb.from('media').select('bytes')); return Math.round(rows.reduce((s, r) => s + Number(r.bytes || 0), 0) / 1048576); }
  const activity = async (n = 50) => must(await sb.from('activity').select('*').order('at', { ascending: false }).limit(n));
  async function admin(action, payload = {}) {
    const { data, error } = await sb.functions.invoke('admin-users', { body: { action, site: VL.config.site, ...payload } });
    if (error) { let msg = error.message; try { msg = (await error.context.json()).fel || msg; } catch (e) {} throw new Error(msg); }
    return data;
  }
  VL.api = { me, settings, updateSettings, signedUrls, headers, withThumbs, monthMemories, recent, search, popular, related, memory,
    createMemory, updateMemory, deleteMemory, duplicateMemory, importKandidater, uploadMedia, removeMedia, setCover, setMediaDay, mergeInto, addLink, removeLink,
    categories, setCategories, addCategory, catName, toggleLike, addComment, approveComment, deleteComment, pendingComments,
    about, updateAbout, uploadAboutPhoto, profiles, updateProfile, uploadAvatar, storageUsedMB, activity, admin, byStart };
})(window.VL);
