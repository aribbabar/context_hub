import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

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
    parser.add_argument("--output-dir")
    parser.add_argument("--output-file")
    args = parser.parse_args()
    if not args.output_dir and not args.output_file:
        parser.error("one of --output-dir or --output-file is required")

    browser_config = BrowserConfig.load(_load_config(args.browser_config))
    crawler_config = CrawlerRunConfig.load(_load_config(args.crawler_config))
    crawler_config.cache_mode = CacheMode.BYPASS
    crawler_config.scraping_strategy = LXMLWebScrapingStrategy()

    results = anyio.run(_crawl, args.url, browser_config, crawler_config)
    markdown_pages = _markdown_pages(results)
    if not markdown_pages:
        raise SystemExit("Crawl completed but did not return any markdown content.")

    if args.output_dir:
        output_dir = Path(args.output_dir)
        _write_markdown_directory(markdown_pages, output_dir)
        print(f"Wrote {len(markdown_pages)} crawled page(s) to {output_dir}")
        return

    output_path = Path(args.output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(page.content for page in markdown_pages), encoding="utf-8")
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


@dataclass(frozen=True)
class MarkdownPage:
    url: str
    title: str | None
    content: str


def _markdown_pages(results: CrawlResult | list[CrawlResult]) -> list[MarkdownPage]:
    crawled_results = results if isinstance(results, list) else [results]
    markdown_pages: list[MarkdownPage] = []

    for result in crawled_results:
        success = bool(getattr(result, "success", True))
        error_message = getattr(result, "error_message", None)
        url = str(getattr(result, "url", "unknown URL"))
        if not success:
            detail = f": {error_message}" if error_message else ""
            print(f"Skipped {url}: crawl failed{detail}")
            continue

        markdown = getattr(result, "markdown", None)
        raw_markdown = getattr(markdown, "raw_markdown", None)
        if not raw_markdown:
            print(f"Skipped {url}: no markdown content")
            continue

        title = _page_title(result, raw_markdown)
        markdown_pages.append(
            MarkdownPage(
                url=url,
                title=title,
                content=_page_content(url, title, raw_markdown),
            )
        )

    return markdown_pages


def _write_markdown_directory(markdown_pages: list[MarkdownPage], output_dir: Path) -> None:
    if output_dir.exists():
        for stale_file in output_dir.glob("*.md"):
            stale_file.unlink()
    else:
        output_dir.mkdir(parents=True, exist_ok=True)

    used_names: set[str] = set()
    for page in markdown_pages:
        filename = _page_filename(page, used_names)
        (output_dir / filename).write_text(page.content, encoding="utf-8")


def _page_content(url: str, title: str | None, raw_markdown: str) -> str:
    frontmatter = [
        "---",
        f'title: "{_yaml_escape(title or _url_label(url))}"',
        f'source_url: "{_yaml_escape(url)}"',
        "---",
        "",
    ]
    return "\n".join(frontmatter) + raw_markdown.strip() + "\n"


def _page_title(result: CrawlResult, raw_markdown: str) -> str | None:
    metadata = getattr(result, "metadata", None)
    if isinstance(metadata, dict):
        for key in ("title", "og:title", "twitter:title"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return _clean_title(value)

    heading = re.search(r"^\s*#\s+(.+?)\s*$", raw_markdown, re.MULTILINE)
    if heading:
        return _clean_title(re.sub(r"\s+#+\s*$", "", heading.group(1)))

    return None


def _page_filename(page: MarkdownPage, used_names: set[str]) -> str:
    label = page.title or _url_label(page.url)
    slug = _slugify(label) or "page"
    url_hash = hashlib.sha1(page.url.encode("utf-8")).hexdigest()[:8]
    base_name = f"{slug}-{url_hash}"

    candidate = f"{base_name}.md"
    counter = 2
    while candidate in used_names:
        candidate = f"{base_name}-{counter}.md"
        counter += 1

    used_names.add(candidate)
    return candidate


def _url_label(url: str) -> str:
    parsed = urlparse(url)
    path_segments = [
        unquote(segment)
        for segment in parsed.path.split("/")
        if segment and not segment.endswith(".html")
    ]
    if path_segments:
        return path_segments[-1]
    return parsed.hostname or "page"


def _slugify(value: str) -> str:
    normalized = unquote(value).lower()
    normalized = re.sub(r"`([^`]+)`", r"\1", normalized)
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = normalized.strip("-")
    return normalized[:80].strip("-")


def _clean_title(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _yaml_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


if __name__ == "__main__":
    main()
