// Offentliga värden. Anon-nyckeln är publik per design – RLS skyddar datan.
VL.config = {
  url: 'https://lxownohxkswzhvwlaznt.supabase.co',
  anonKey: 'sb_publishable_GBGlS3vEVgUaJbGaCligUg_vVJA9Xyx',
  // sidans rotadress (utan avslutande /) som inbjudnings- och återställningslänkar pekar på
  // offentlig nyckel för push-notiser (den privata finns bara som hemlighet i Supabase)
  vapidPublic: 'BJErOsQeStobTy66TztQPqZJK-DcYrj-sEa8BIKZa2hMW7fwRANlAOYU_2vLSQ599zcii4cfoBBVSJps8fjC5KQ',
  site: location.origin + location.pathname.replace(/\/[^/]*$/, ''),
};
