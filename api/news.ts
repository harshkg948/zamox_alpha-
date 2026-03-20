// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Basic rate limiting setup
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 10;
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipStr = Array.isArray(ip) ? ip[0] : ip;
  
  const now = Date.now();
  const rateLimitInfo = rateLimitMap.get(ipStr);

  if (rateLimitInfo && now - rateLimitInfo.timestamp < RATE_LIMIT_WINDOW) {
    if (rateLimitInfo.count >= MAX_REQUESTS_PER_IP) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    rateLimitInfo.count += 1;
  } else {
    rateLimitMap.set(ipStr, { count: 1, timestamp: now });
  }

  try {
    const { query } = req.query;
    const searchQuery = typeof query === 'string' && query.trim() !== '' ? query : 'Technology Career';
    
    // Check Cache
    const cachedItem = cache.get(searchQuery);
    if (cachedItem && now - cachedItem.timestamp < CACHE_DURATION) {
      return res.status(200).json(cachedItem.data);
    }

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'NEWS_API_KEY environment variable is missing.' });
    }

    // Get date for 14 days ago to stay well within Developer plan limits
    const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&from=${fromDate}&sortBy=popularity&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NewsAPI responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Set Cache
    cache.set(searchQuery, { data, timestamp: now });

    // Periodically clean up old cache and rate limits to prevent memory leaks in serverless instances
    if (Math.random() < 0.1) {
      for (const [key, val] of cache.entries()) {
        if (now - val.timestamp > CACHE_DURATION) cache.delete(key);
      }
      for (const [key, val] of rateLimitMap.entries()) {
        if (now - val.timestamp > RATE_LIMIT_WINDOW) rateLimitMap.delete(key);
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch news data.' });
  }
}
