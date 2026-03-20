const query = 'AI ML engineer';
const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&sortBy=popularity&apiKey=9f4e45a920684122819d22301bd62d7f`;

fetch(url)
  .then(r => r.json())
  .then(data => {
    if (data.status === 'error') {
      console.error('API Error:', data.message);
    } else {
      console.log('Success!', data.articles.length > 0 ? data.articles[0].title : '0 articles');
    }
  })
  .catch(console.error);
