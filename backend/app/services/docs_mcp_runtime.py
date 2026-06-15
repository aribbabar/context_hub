from shutil import which
from pathlib import Path

from app.core.config import get_settings


DOCS_MCP_PACKAGE = "@arabold/docs-mcp-server@latest"


class DocsMcpRuntime:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.npx_command = which("npx.cmd") or which("npx")

    def command_prefix(self) -> list[str]:
        if self.npx_command:
            return [
                self.npx_command,
                "-y",
                DOCS_MCP_PACKAGE,
            ]

        raise RuntimeError(
            "docs-mcp-server CLI is not available. Install Node.js so npx can run "
            f"{DOCS_MCP_PACKAGE}. The local docs-mcp-server directory is reference-only "
            "and is not used at runtime."
        )

    def command_cwd(self) -> Path:
        return self.settings.project_root
