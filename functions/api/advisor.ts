export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode'); // 'search' 或 'recommend'
  const lang = url.searchParams.get('lang') || 'english';
  const lat = url.searchParams.get('lat') || '22.3193';
  const lon = url.searchParams.get('lon') || '114.1694';

  try {
    // 1. 獲取天氣
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${env.OPENWEATHER_API_KEY}&units=metric`
    );
    const weather = await weatherRes.json();
    const temp = weather.main.temp;

    // --- 模式 A: 搜尋商品 (用戶挑選階段) ---
    if (mode === 'search') {
      const userQuery = url.searchParams.get('q') || 'casual';
      
      // 同時向 Amazon 與 Zalando 請求數據
      // 這裡使用了 X-RapidAPI-Key 進行授權
      const [amazonData, zalandoData] = await Promise.all([
        fetchRapidAPI(env, env.AMAZON_HOST, `/az/search?keywords=${encodeURIComponent(userQuery)}`, env.RAPIDAPI_KEY_AMAZON),
        fetchRapidAPI(env, env.ZALANDO_HOST, `/articles?name=${encodeURIComponent(userQuery)}`, env.RAPIDAPI_KEY_ZALANDO)
      ]);

      const results = [
        ...formatAmazon(amazonData, env.AMAZON_TAG),
        ...formatZalando(zalandoData, env.ZALANDO_TAG)
      ];

      return Response.json({ weather, products: results });
    }

    // --- 模式 B: 配對建議 (AI 生成 Outlook) ---
    if (mode === 'recommend') {
      const selectedItem = JSON.parse(url.searchParams.get('item') || '{}');
      
      // 這裡呼叫 Gemini API (透過 env.GEMINI_API_KEY)
      // 提示詞會根據天氣、語言和選中單品動態生成
      const prompt = `User selected: ${selectedItem.name}. Weather: ${temp}°C, ${weather.weather[0].description}. 
                      Language: ${lang}. Provide a poetic outfit title and 3 style tips. Return JSON.`;
      
      // 這裡簡化模擬 Gemini 回傳內容
      const outlook = {
        title: lang === 'english' ? "The Ethereal Urbanite" : "城市漫遊者",
        description: `基於您的 ${selectedItem.name}，在 ${temp}°C 的天氣下...`,
        style_tips: ["Tip 1", "Tip 2"],
        selectedLink: selectedItem.url
      };

      return Response.json({ outlook });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 輔助函式
async function fetchRapidAPI(env, host, path, key) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host }
  });
  return res.json();
}

function formatAmazon(data, tag) {
  return (data.products || []).slice(0, 4).map(p => ({
    source: 'Amazon',
    name: p.title,
    price: p.price,
    url: `${p.url}${p.url.includes('?') ? '&' : '?'}tag=${tag}`,
    image: p.image
  }));
}

function formatZalando(data, tag) {
  return (data.content || []).slice(0, 4).map(p => ({
    source: 'Zalando',
    name: p.name,
    price: p.price?.formatted,
    url: `${p.shopUrl}?aff_id=${tag}`,
    image: p.media?.images[0]?.url
  }));
}
