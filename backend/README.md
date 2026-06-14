# Context Hub Backend

FastAPI service for orchestrating local-folder and web-doc indexing.

## Key Modules

- `app/main.py` - FastAPI app factory and router registration.
- `app/api/` - HTTP routes.
- `app/core/config.py` - filesystem and external command settings.
- `app/models/` - request and response models.
- `app/services/source_registry.py` - durable wrapper source/job registry.
- `app/services/docs_mcp.py` - adapter for invoking `docs-mcp-server`.
- `app/services/crawl4ai_scraper.py` - adapter boundary for crawl4ai web crawls.
- `app/services/path_utils.py` - path normalization and `file:///` conversion.

The first implementation should keep orchestration thin: store wrapper state here, but let `docs-mcp-server` remain the indexing/search authority.
