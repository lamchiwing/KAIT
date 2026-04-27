export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');
  const lang = url.searchParams.get('lang') || 'english';
  const lat = url.searchParams.get('lat') || '22.3';
  const lon = url.searchParams.get('lon') || '114.1';

  try {
    // 1. 獲取實時天氣
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}&units=metric`
    );
    const weather = await weatherRes.json();
    const temp = weather.main?.temp || 15;

    // --- 模式 A: 產品搜尋 (用戶挑選) ---
    if (mode === 'search') {
      const query = url.searchParams.get('q') || 'minimalist';
      
      // 根據語言設定地區代碼 (Locale)
      const localeMap: any = { english: 'en-GB', svenska: 'sv-SE', português: 'pt-PT' };
      const currentLocale = localeMap[lang] || 'en-GB';

      // 並行請求 Amazon 與 Zalando
      const [amazonData, zalandoData] = await Promise.all([
        fetchRapidAPI(env.AMAZON_HOST, `/az/search?keywords=${encodeURIComponent(query)}`, env.RAPIDAPI_KEY_AMAZON),
        fetchRapidAPI(env.ZALANDO_HOST, `/articles?name=${encodeURIComponent(query)}&full_locale=${currentLocale}`, env.RAPIDAPI_KEY_ZALANDO)
      ]);

      const results = [
        ...formatAmazon(amazonData, env.AMAZON_TAG),
        ...formatZalando(zalandoData, env.ZALANDO_TAG)
      ];

      return Response.json({ weather, products: results });
    }

    // --- 模式 B: AI 配對建議 ---
    if (mode === 'recommend') {
      const item = JSON.parse(url.searchParams.get('item') || '{}');
      
      // 構建 Gemini Prompt
      const prompt = `Current Weather: ${temp}°C, ${weather.weather[0].description}. 
                      The user selected: ${item.name}. 
                      Language: ${lang}. 
                      Provide a poetic outlook title and 3 concise styling tips in ${lang}. 
                      Format: JSON { "title": "...", "tips": ["...", "...", "..."] }`;

      const genAIRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const aiData = await genAIRes.json();
      const aiResponse = JSON.parse(aiData.candidates[0].content.parts[0].text.replace(/```json|```/g, ''));

      return Response.json({ 
        outlook: {
          ...aiResponse,
          image: item.image,
          url: item.url
        } 
      });
    }

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function fetchRapidAPI(host: string, path: string, key: string) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host }
  });
  return res.json();
}

function formatAmazon(data: any, tag: string) {
  return (data.products || []).slice(0, 3).map((p: any) => ({
    source: 'Amazon',
    name: p.title,
    price: p.price,
    image: p.image,
    url: `${p.url}?tag=${tag}`
  }));
}

function formatZalando(data: any, tag: string) {
  return (data.content || []).slice(0, 3).map((p: any) => ({
    source: 'Zalando',
    name: p.name,
    price: p.price?.formatted,
    image: p.media?.images[0]?.url,
    url: `${p.shopUrl}?aff_id=${tag}`
  }));
}
