/* ============================================================
   JAYARAYA — LIVE STATS (Netlify Function)
   Menarik data otomatis:
   - Google Places  : rating, jumlah ulasan, ulasan positif (>= 4 bintang)
   - Instagram      : followers_count
   Semua kunci disimpan sebagai Environment Variables di Netlify
   (Site settings -> Environment variables), TIDAK di dalam kode.

   Env vars yang dibaca:
     GOOGLE_PLACES_API_KEY   -> API key Google Cloud (Places API + billing aktif)
     GOOGLE_PLACE_ID         -> Place ID outlet JAYARAYA
     IG_USER_ID              -> Instagram Business/Creator user id (angka)
     IG_ACCESS_TOKEN         -> long-lived token Instagram Graph API

   Kalau sebuah kunci belum diisi, bagiannya dilewati (situs pakai angka manual).
   Hasil di-cache 6 jam di CDN agar hemat kuota & biaya.
============================================================ */
exports.handler = async function () {
  const out = {};
  const env = process.env;

  // ---- Google Places (rating, jumlah ulasan, ulasan) ----
  if (env.GOOGLE_PLACES_API_KEY && env.GOOGLE_PLACE_ID) {
    try {
      const url = 'https://places.googleapis.com/v1/places/' +
        encodeURIComponent(env.GOOGLE_PLACE_ID) + '?languageCode=id';
      const res = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews'
        }
      });
      const j = await res.json();
      if (typeof j.rating === 'number') out.rating = j.rating;
      if (typeof j.userRatingCount === 'number') out.reviewsCount = j.userRatingCount;
      if (Array.isArray(j.reviews)) {
        out.reviews = j.reviews
          .filter(function (rv) { return (rv.rating || 5) >= 4; }) // hanya ulasan positif
          .slice(0, 3)
          .map(function (rv) {
            const txt = (rv.text && rv.text.text) ||
                        (rv.originalText && rv.originalText.text) || '';
            const name = (rv.authorAttribution && rv.authorAttribution.displayName) || 'Pengunjung Google';
            return { author: name, rating: rv.rating || 5, text: String(txt).slice(0, 220) };
          });
      }
    } catch (e) { /* lewati; front-end pakai angka manual */ }
  }

  // ---- Instagram followers ----
  if (env.IG_USER_ID && env.IG_ACCESS_TOKEN) {
    try {
      const url = 'https://graph.facebook.com/v20.0/' +
        encodeURIComponent(env.IG_USER_ID) +
        '?fields=followers_count&access_token=' + encodeURIComponent(env.IG_ACCESS_TOKEN);
      const res = await fetch(url);
      const j = await res.json();
      if (j && typeof j.followers_count === 'number') out.followers = j.followers_count;
    } catch (e) { /* lewati */ }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      // cache 6 jam di CDN Netlify -> API dipanggil ~4x/hari saja
      'Cache-Control': 'public, max-age=21600, s-maxage=21600',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(out)
  };
};
