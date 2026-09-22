"""Standard API response wrappers."""
from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool
    message: str = ""
    data: Optional[Any] = None


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: list[ErrorDetail] = []


def success_response(data: Any = None, message: str = "Success") -> dict:
    return {"success": True, "message": message, "data": data}


def error_response(message: str, errors: list[dict] | None = None) -> dict:
    return {"success": False, "message": message, "errors": errors or []}
