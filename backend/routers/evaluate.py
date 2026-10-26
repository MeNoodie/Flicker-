"""
evaluate.py — POST /api/evaluate
Runs the LangGraph evaluation pipeline on a completed session.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend.agents.evaluator_agent import evaluation_graph
from backend.config import AppConfig, get_config
from backend.middleware.auth import get_current_user_id
from backend.schemas.evaluation import EvaluateRequest, EvaluateResponse

router = APIRouter(prefix="/api", tags=["evaluate"])


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_session(
    body: EvaluateRequest,
    user_id: str = Depends(get_current_user_id),
    cfg: AppConfig = Depends(get_config),
) -> EvaluateResponse:
    """
    Evaluate a transcribed practice session.
    Loads trusted data from DB — never accepts client-supplied scores or concepts.
    """
    from backend.db.supabase_client import get_service_client

    db = get_service_client(cfg)

    # Verify ownership and fetch transcript
    session_row = (
        db.table("practice_sessions")
        .select("id, user_id, status")
        .eq("id", body.session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not session_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session = session_row.data

    # Only evaluate sessions that have been transcribed
    if session["status"] not in ("transcribing", "evaluating"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot evaluate session with status '{session['status']}'",
        )

    # Fetch stored transcript from evaluations table (may already exist as retry)
    eval_row = (
        db.table("evaluations")
        .select("transcript")
        .eq("session_id", body.session_id)
        .maybe_single()
        .execute()
    )

    if not eval_row.data or not eval_row.data.get("transcript"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transcript found for this session. Transcribe first.",
        )

    transcript = eval_row.data["transcript"]

    # Update status to evaluating
    db.table("practice_sessions").update({"status": "evaluating"}).eq(
        "id", body.session_id
    ).execute()

    # Run LangGraph evaluation pipeline
    final_state = await evaluation_graph.ainvoke({
        "session_id": body.session_id,
        "user_id": user_id,
        "transcript": transcript,
        "cfg": cfg,
    })

    if final_state.get("error") and not final_state.get("result"):
        # Preserve session for recovery
        db.table("practice_sessions").update({"status": "failed"}).eq(
            "id", body.session_id
        ).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evaluation failed: {final_state['error']}",
        )

    result = final_state.get("result")
    return EvaluateResponse(
        success=True,
        result=result,
        needs_retry=result.needs_retry if result else False,
        retry_reason=result.retry_reason if result else None,
    )
