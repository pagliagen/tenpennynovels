"""
In-memory async job queue with a single worker.
Jobs are processed one at a time to avoid GPU contention.
"""

import asyncio
import logging
import uuid
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx

import generator
import prompts

logger = logging.getLogger("image-gen.queue")


class JobStatus(str, Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    CALLING_BACK = "calling_back"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    entity_type: str
    record: dict[str, Any]
    style: str | None
    width: int
    height: int
    image_format: str
    callback_url: str
    callback_method: str
    callback_headers: dict[str, str]
    status: JobStatus = JobStatus.QUEUED
    queue_position: int = 0
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


_jobs: dict[str, Job] = {}
_queue: asyncio.Queue[str] = asyncio.Queue()


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def get_queue_size() -> int:
    return _queue.qsize()


async def enqueue(
    entity_type: str,
    record: dict[str, Any],
    style: str | None,
    width: int,
    height: int,
    image_format: str,
    callback_url: str,
    callback_method: str = "POST",
    callback_headers: dict[str, str] | None = None,
) -> Job:
    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        entity_type=entity_type,
        record=record,
        style=style,
        width=width,
        height=height,
        image_format=image_format,
        callback_url=callback_url,
        callback_method=callback_method,
        callback_headers=callback_headers or {},
        queue_position=_queue.qsize(),
    )
    _jobs[job_id] = job
    await _queue.put(job_id)
    logger.info(f"Job {job_id} enqueued (queue size: {_queue.qsize()})")
    return job


async def _process_job(job: Job) -> None:
    job.status = JobStatus.GENERATING
    logger.info(f"Processing job {job.id} ({job.entity_type})")

    try:
        prompt = prompts.build_prompt(job.entity_type, job.record, job.style)
        logger.info(f"Prompt: {prompt[:200]}...")

        result = await asyncio.to_thread(
            generator.generate_image,
            prompt=prompt,
            width=job.width,
            height=job.height,
            image_format=job.image_format,
        )

        job.result = result
        job.status = JobStatus.CALLING_BACK

        callback_payload = {
            "success": True,
            "jobId": job.id,
            "entityType": job.entity_type,
            "image": {
                "base64": result["base64"],
                "format": result["format"],
                "width": result["width"],
                "height": result["height"],
            },
            "metadata": {
                "model": generator.config.MODEL_ID,
                "seed": result["seed"],
                "steps": result["steps"],
                "processingMs": result["processing_ms"],
                "prompt": prompt,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            method = job.callback_method.upper()
            resp = await client.request(
                method,
                job.callback_url,
                json=callback_payload,
                headers=job.callback_headers,
            )
            resp.raise_for_status()

        job.status = JobStatus.COMPLETED
        logger.info(f"Job {job.id} completed, callback sent ({resp.status_code})")

    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        logger.error(f"Job {job.id} failed: {e}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.request(
                    job.callback_method.upper(),
                    job.callback_url,
                    json={
                        "success": False,
                        "jobId": job.id,
                        "entityType": job.entity_type,
                        "error": str(e),
                    },
                    headers=job.callback_headers,
                )
        except Exception as cb_err:
            logger.error(f"Failed to send error callback for {job.id}: {cb_err}")


async def worker() -> None:
    """Single worker that processes jobs one at a time."""
    logger.info("Queue worker started")
    while True:
        job_id = await _queue.get()
        job = _jobs.get(job_id)
        if job is None:
            _queue.task_done()
            continue

        for remaining_id in list(_jobs):
            remaining = _jobs.get(remaining_id)
            if remaining and remaining.status == JobStatus.QUEUED:
                remaining.queue_position = max(0, remaining.queue_position - 1)

        await _process_job(job)
        _queue.task_done()

        _cleanup_old_jobs()


def _cleanup_old_jobs() -> None:
    """Remove completed/failed jobs older than 1 hour."""
    cutoff = time.time() - 3600
    to_remove = [
        jid for jid, j in _jobs.items()
        if j.status in (JobStatus.COMPLETED, JobStatus.FAILED) and j.created_at < cutoff
    ]
    for jid in to_remove:
        del _jobs[jid]
