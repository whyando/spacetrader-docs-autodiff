import { Dataset, CheerioCrawler, log, LogLevel } from 'crawlee';
import fs from 'fs'

log.setLevel(LogLevel.DEBUG);

const crawler = new CheerioCrawler({
    minConcurrency: 1,
    maxConcurrency: 1,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: 30,

    maxRequestsPerCrawl: 1000,

    // - $: the cheerio object containing parsed HTML
    async requestHandler({ request, enqueueLinks, $ }) {
        log.debug(`Processing ${request.url}...`);

        // Extract data from the page using cheerio.
        const title = $('title').text();

        const article_text = []
        function f(el) {
            const x = $(el)
            if (el.type == 'tag' && ['h1','h2','p','code'].includes(el.name)) {
                article_text.push({
                    tag: el.name,
                    text: x.text(),
                })
            } else {
                x.children().toArray().forEach(e => f(e))
            }
        }
        $('article').toArray().forEach(e => f(e))

        // Store the results to the dataset. In local configuration,
        // the data will be stored as JSON files in ./storage/datasets/default
        await Dataset.pushData({
            url: request.url,
            title,
            article_text,
        });
        await enqueueLinks();
    },

    // This function is called if the page processing failed more than maxRequestRetries + 1 times.
    failedRequestHandler({ request }) {
        log.debug(`Request ${request.url} failed twice.`);
    },
});

// Run crawler
await crawler.run([
    'https://docs.spacetraders.io',
]);
log.debug('Crawler finished.');

// save the dataset to files
const dataset = await Dataset.open('default')
await dataset.forEach(async (article, index) => {
    // extract the path only from the url
    const pathMatch = article.url.match(/https:\/\/docs\.spacetraders\.io\/(.*)/)
    if (!pathMatch) return
    const file = './docs/' + pathMatch[1]

    // create the directory if it doesn't exist
    const dir = file.split('/').slice(0,-1).join('/')
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    const content = article.title + '\n\n'
        + article.article_text.map(x => x.tag + '\n' + x.text).join('\n\n')
    fs.writeFileSync(file, content)
})
