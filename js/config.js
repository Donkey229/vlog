// Offentliga värden. Anon-nyckeln är publik per design – RLS skyddar datan.
VL.config = {
  url: 'https://lxownohxkswzhvwlaznt.supabase.co',
  anonKey: 'sb_publishable_GBGlS3vEVgUaJbGaCligUg_vVJA9Xyx',
  // sidans rotadress (utan avslutande /) som inbjudnings- och återställningslänkar pekar på
  site: location.origin + location.pathname.replace(/\/[^/]*$/, ''),
};
