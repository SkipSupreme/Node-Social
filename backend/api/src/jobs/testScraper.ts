import { scrapeArticle } from './articleScraper.js';

async function test() {
  const url = 'https://dev.to/gnarlylasagna/building-a-virtualized-cybersecurity-lab-splunk-siem-setup-and-log-forwarding-4k14';
  console.log('Scraping:', url);
  const result = await scrapeArticle(url);
  console.log('\nResult:');
  console.log('Title:', result?.title);
  console.log('Lead Image:', result?.leadImage);
  console.log('Content length:', result?.content?.length);
  console.log('Content preview:', result?.content?.slice(0, 1000));
  console.log('\n--- Check for broken tags ---');
  if (result?.content?.includes('<img') || result?.content?.includes('src=')) {
    console.log('⚠️  BROKEN: Contains img/src tags!');
    const matches = result?.content?.match(/<img[^>]*>|src=['\"][^'\"]*['\"]/g);
    console.log('Found:', matches?.slice(0, 5));
  } else {
    console.log('✅ No broken tags found');
  }
}
test();
