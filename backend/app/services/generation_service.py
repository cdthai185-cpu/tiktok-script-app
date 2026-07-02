from __future__ import annotations
import json
import re
from typing import Any

from openai import OpenAI, APIError
from anthropic import Anthropic

from ..config import settings, has_llm_key
from . import samples_service
from .prompts import (
    build_system_prompt,
    build_user_prompt,
    build_critique_prompt,
    build_questions_prompt,
    word_range,
)


class GenerationError(RuntimeError):
    pass


def _generate_text(system: str, user: str, max_tokens: int, temperature: float = 0.8) -> str:
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
            temperature=temperature,
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


def _critique(
    script: str,
    input_text: str,
    profile_md: str,
    duration_seconds: int,
    tone: str,
) -> dict[str, Any]:
    prompt = build_critique_prompt(script, input_text, profile_md, duration_seconds, tone)
    system_critic = (
        "Bạn là editor khắc nghiệt chấm kịch bản TikTok. "
        "Trả JSON đúng format, KHÔNG markdown code fence, KHÔNG kèm gì khác."
    )
    try:
        raw = _generate_text(system_critic, prompt, max_tokens=1200, temperature=0.3)
    except APIError as e:
        return {"scores": {}, "overall_pass": False, "summary": f"Critique API lỗi: {e}"}

    m = re.search(r"\{.*\}", raw.strip(), re.DOTALL)
    if not m:
        return {"scores": {}, "overall_pass": False, "summary": f"Critique parse fail: {raw[:200]}"}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        return {"scores": {}, "overall_pass": False, "summary": f"JSON decode fail: {e}"}


def _separate_script_and_hints(text: str) -> tuple[str, str]:
    m = re.search(r"\n\s*\[GỢI\s*Ý\s*HÌNH\]:?\s*\n?(.*)$", text, re.IGNORECASE | re.DOTALL)
    if m:
        return text[: m.start()].strip(), m.group(1).strip()
    return text.strip(), ""


def generate_variants(
    input_text: str,
    duration_seconds: int = 60,
    tone: str = "default",
    context_qa: str = "",
) -> dict[str, Any]:
    if not input_text.strip():
        raise GenerationError("Mô tả video trống.")

    profile_md = samples_service.profile_text()
    samples = samples_service.load_samples()

    results: list[dict[str, Any]] = []
    wmin, wtarget, wmax = word_range(duration_seconds, tone)

    for variant_index in range(settings.generation_variants):
        regens_left = settings.critique_max_regens
        attempts: list[dict[str, Any]] = []
        chosen: dict[str, Any] | None = None

        while True:
            system = build_system_prompt(profile_md, samples, duration_seconds, tone)
            user = build_user_prompt(input_text, context_qa, variant_index)
            try:
                raw = _generate_text(system, user, max_tokens=settings.llm_max_tokens)
            except APIError as e:
                raise GenerationError(f"LLM API lỗi: {e}") from e

            script, hints = _separate_script_and_hints(raw)
            critique = _critique(script, input_text, profile_md, duration_seconds, tone)
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
        "duration_seconds": duration_seconds,
        "style_tone": tone,
        "context_qa_used": bool(context_qa.strip()),
        "word_range": {"min": wmin, "target": wtarget, "max": wmax},
        "samples_used": len(samples),
        "provider": settings.llm_provider,
        "model": settings.groq_llm_model if settings.llm_provider == "groq" else settings.claude_model,
        "variants": results,
    }


def suggest_questions(input_text: str, duration_seconds: int = 60) -> dict[str, Any]:
    """Sinh 5 câu hỏi cụ thể cho video để user trả lời trước khi sinh kịch bản."""
    if not input_text.strip():
        raise GenerationError("Mô tả video trống.")

    prompt = build_questions_prompt(input_text, duration_seconds)
    system_q = (
        "Bạn giúp user làm content TikTok chuẩn bị kịch bản. "
        "Sinh câu hỏi CỤ THỂ SÁT video user mô tả. Trả JSON đúng format."
    )
    try:
        raw = _generate_text(system_q, prompt, max_tokens=800, temperature=0.6)
    except APIError as e:
        raise GenerationError(f"LLM API lỗi: {e}") from e

    m = re.search(r"\{.*\}", raw.strip(), re.DOTALL)
    if not m:
        return {"questions": [], "raw": raw[:500]}
    try:
        data = json.loads(m.group(0))
        questions = data.get("questions", [])
        # Sanitize: chỉ giữ string non-empty
        questions = [str(q).strip() for q in questions if str(q).strip()][:6]
        return {"questions": questions}
    except json.JSONDecodeError:
        return {"questions": [], "raw": raw[:500]}
