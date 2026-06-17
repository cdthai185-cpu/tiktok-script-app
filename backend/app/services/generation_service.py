from __future__ import annotations
import json
import re
from typing import Any

from openai import OpenAI, APIError
from anthropic import Anthropic

from ..config import settings, has_llm_key
from . import samples_service
from .prompts import build_system_prompt, build_user_prompt, build_critique_prompt


class GenerationError(RuntimeError):
    pass


# === LLM client abstraction ===
# Hỗ trợ Groq (default, free) và Anthropic (paid).
# Cả 2 đều input system + user → output text.


def _generate_text(system: str, user: str, max_tokens: int) -> str:
    if not has_llm_key():
        raise GenerationError(
            "API key chưa được set. "
            f"Provider hiện tại: {settings.llm_provider}. "
            "Paste key vào backend/.env rồi restart backend."
        )

    if settings.llm_provider == "groq":
        client = OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)
        resp = client.chat.completions.create(
            model=settings.groq_llm_model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.8,
        )
        return (resp.choices[0].message.content or "").strip()

    if settings.llm_provider == "anthropic":
        client = Anthropic(api_key=settings.anthropic_api_key)
        resp = client.messages.create(
            model=settings.claude_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = ""
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                text += block.text
        return text.strip()

    raise GenerationError(f"Provider không hỗ trợ: {settings.llm_provider}")


def _word_count_vi(text: str) -> int:
    return len(re.findall(r"\S+", text))


def _critique(script: str, input_text: str, profile_md: str) -> dict[str, Any]:
    prompt = build_critique_prompt(script, input_text, profile_md)
    system_critic = (
        "Bạn là editor khắc nghiệt chấm kịch bản TikTok. "
        "Trả JSON đúng format, KHÔNG markdown code fence, KHÔNG kèm gì khác."
    )
    try:
        raw = _generate_text(system_critic, prompt, max_tokens=1200)
    except APIError as e:
        return {
            "scores": {},
            "overall_pass": False,
            "summary": f"Critique API lỗi: {e}",
        }

    raw = raw.strip()
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return {
            "scores": {},
            "overall_pass": False,
            "summary": f"Critique parse fail: {raw[:200]}",
        }
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        return {
            "scores": {},
            "overall_pass": False,
            "summary": f"JSON decode fail: {e}",
        }


def _separate_script_and_hints(text: str) -> tuple[str, str]:
    """Tách [GỢI Ý HÌNH] khỏi kịch bản."""
    m = re.search(r"\n\s*\[GỢI\s*Ý\s*HÌNH\]:?\s*\n?(.*)$", text, re.IGNORECASE | re.DOTALL)
    if m:
        script = text[: m.start()].strip()
        hints = m.group(1).strip()
        return script, hints
    return text.strip(), ""


def generate_variants(input_text: str) -> dict[str, Any]:
    if not input_text.strip():
        raise GenerationError("Mô tả video trống.")

    profile_md = samples_service.profile_text()
    samples = samples_service.load_samples()

    results: list[dict[str, Any]] = []

    for variant_index in range(settings.generation_variants):
        regens_left = settings.critique_max_regens
        attempts: list[dict[str, Any]] = []
        chosen: dict[str, Any] | None = None

        while True:
            system = build_system_prompt(profile_md, samples)
            user = build_user_prompt(input_text, variant_index)
            try:
                raw = _generate_text(system, user, max_tokens=settings.llm_max_tokens)
            except APIError as e:
                raise GenerationError(f"LLM API lỗi: {e}") from e

            script, hints = _separate_script_and_hints(raw)
            critique = _critique(script, input_text, profile_md)
            wc = _word_count_vi(script)

            attempt = {
                "script": script,
                "hints": hints,
                "word_count": wc,
                "critique": critique,
                "pass": bool(critique.get("overall_pass")),
            }
            attempts.append(attempt)

            if attempt["pass"] or regens_left <= 0:
                chosen = attempt
                break
            regens_left -= 1

        results.append({
            "variant_index": variant_index,
            "attempts": attempts,
            "chosen": chosen,
        })

    return {
        "input_text": input_text,
        "samples_used": len(samples),
        "provider": settings.llm_provider,
        "model": settings.groq_llm_model if settings.llm_provider == "groq" else settings.claude_model,
        "variants": results,
    }
