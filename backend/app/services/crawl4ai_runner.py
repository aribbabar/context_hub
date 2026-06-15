import argparse
import json
from pathlib import Path

import anyio
from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
    CrawlResult,
    LXMLWebScrapingStrategy,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Crawl4AI and write successful markdown pages.")
    parser.add_argument("url")
    parser.add_argument("--crawler-config", required=True)
    parser.add_argument("--browser-config", required=True)
    parser.add_argument("--output-file", required=True)
    args = parser.parse_args()

    browser_config = BrowserConfig.load(_load_config(args.browser_config))
    crawler_config = CrawlerRunConfig.load(_load_config(args.crawler_config))
    crawler_config.cache_mode = CacheMode.BYPASS
    crawler_config.scraping_strategy = LXMLWebScrapingStrategy()

    results = anyio.run(_crawl, args.url, browser_config, crawler_config)
    markdown_pages = _markdown_pages(results)
    if not markdown_pages:
        raise SystemExit("Crawl completed but did not return any markdown content.")

    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(markdown_pages), encoding="utf-8")
    print(f"Wrote {len(markdown_pages)} crawled page(s) to {output_path}")


def _load_config(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


async def _crawl(
    url: str,
    browser_config: BrowserConfig,
    crawler_config: CrawlerRunConfig,
) -> CrawlResult | list[CrawlResult]:
    async with AsyncWebCrawler(config=browser_config) as crawler:
        return await crawler.arun(url=url, config=crawler_config)


def _markdown_pages(results: CrawlResult | list[CrawlResult]) -> list[str]:
    crawled_results = results if isinstance(results, list) else [results]
    markdown_pages: list[str] = []

    for result in crawled_results:
        markdown = getattr(result, "markdown", None)
        raw_markdown = getattr(markdown, "raw_markdown", None)
        if not raw_markdown:
            print(f"Skipped {getattr(result, 'url', 'unknown URL')}: no markdown content")
            continue

        markdown_pages.append(
            f"\n\n{'=' * 60}\n# {getattr(result, 'url', 'unknown URL')}\n{'=' * 60}\n\n{raw_markdown}"
        )

    return markdown_pages


if __name__ == "__main__":
    main()
