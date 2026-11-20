from app.core.config import Settings
from app.harness.providers.anthropic import AnthropicProvider
from app.harness.providers.base import LLMProvider
from app.harness.providers.openai_compat import OpenAICompatProvider


def build_provider(settings: Settings) -> LLMProvider:
    """Factory: picks the implementation from configuration only."""
    if settings.llm_provider == "anthropic":
        return AnthropicProvider(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            timeout_s=settings.llm_timeout_s,
            max_tokens=settings.llm_max_tokens,
        )
    return OpenAICompatProvider(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        timeout_s=settings.llm_timeout_s,
        max_tokens=settings.llm_max_tokens,
    )
