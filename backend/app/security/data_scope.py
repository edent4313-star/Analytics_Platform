"""
CRITICAL SECURITY MODULE: Organizational Data Scope Enforcement

Single source of truth for data-level security.

Rules:
  - An empty organizational assignment NEVER means access to all data.
  - HEAD_OFFICE does NOT grant unrestricted access unless
    users.unrestricted_org_access is explicitly true.
  - REGION / DISTRICT / BRANCH are limited to assigned units and descendants.
  - Unknown or incomplete assignments deny all analytical rows.

NEVER construct DataScope from user-supplied request parameters.
ALWAYS construct from the authenticated user object.
"""
from typing import Optional, TYPE_CHECKING
from app.database.data_access import DataScope

if TYPE_CHECKING:
    from app.models.user import User


def _has_unrestricted_policy(user: "User") -> bool:
    return bool(getattr(user, "unrestricted_org_access", False))


def get_data_scope(user: "User") -> DataScope:
    """
    Build a DataScope from the authenticated user's profile.

    This is the authoritative scope used to inject WHERE clauses into every
    analytical query. It cannot be overridden by the frontend.
    """
    access_level = (user.access_level or "").upper()

    if _has_unrestricted_policy(user):
        return DataScope(
            access_level=access_level or "HEAD_OFFICE",
            unrestricted_org_access=True,
            deny_all=False,
            region_ids=None,
            district_ids=None,
            branch_ids=None,
        )

    if access_level == "HEAD_OFFICE":
        # Head Office without an explicit unrestricted policy sees no org-scoped rows.
        return DataScope(
            access_level="HEAD_OFFICE",
            unrestricted_org_access=False,
            deny_all=True,
        )

    if access_level == "REGION":
        if not user.region_id:
            return DataScope(access_level="REGION", deny_all=True)
        return DataScope(
            access_level="REGION",
            region_ids=[user.region_id],
            district_ids=None,
            branch_ids=None,
        )

    if access_level == "DISTRICT":
        if not user.district_id:
            return DataScope(access_level="DISTRICT", deny_all=True)
        return DataScope(
            access_level="DISTRICT",
            region_ids=[user.region_id] if user.region_id else None,
            district_ids=[user.district_id],
            branch_ids=None,
        )

    if access_level == "BRANCH":
        if not user.branch_id:
            return DataScope(access_level="BRANCH", deny_all=True)
        return DataScope(
            access_level="BRANCH",
            region_ids=[user.region_id] if user.region_id else None,
            district_ids=[user.district_id] if user.district_id else None,
            branch_ids=[user.branch_id],
        )

    return DataScope(access_level=access_level or "UNKNOWN", deny_all=True)


def validate_org_filter_request(
    requested_branch_id: Optional[int],
    requested_district_id: Optional[int],
    requested_region_id: Optional[int],
    scope: DataScope,
) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """
    Validate user-requested org filters against their authorized scope.
    Users may narrow their own scope. They can NEVER widen it.

    Returns (None, None, None) if the requested filter is out of scope
    and should be rejected with a 403 error. A deny-all scope always rejects
    explicit out-of-scope requests; callers must still apply deny-all on queries.
    """
    if scope.deny_all:
        if requested_branch_id or requested_district_id or requested_region_id:
            return None, None, None
        return None, None, None

    if scope.is_unrestricted:
        return requested_branch_id, requested_district_id, requested_region_id

    if scope.access_level == "BRANCH":
        effective_branch = scope.branch_ids[0] if scope.branch_ids else None
        if requested_branch_id and requested_branch_id != effective_branch:
            return None, None, None
        return (
            effective_branch,
            scope.district_ids[0] if scope.district_ids else None,
            scope.region_ids[0] if scope.region_ids else None,
        )

    if scope.access_level == "DISTRICT":
        effective_district = scope.district_ids[0] if scope.district_ids else None
        if requested_district_id and requested_district_id != effective_district:
            return None, None, None
        if requested_branch_id is None:
            return None, effective_district, scope.region_ids[0] if scope.region_ids else None
        return requested_branch_id, effective_district, scope.region_ids[0] if scope.region_ids else None

    if scope.access_level == "REGION":
        effective_region = scope.region_ids[0] if scope.region_ids else None
        if requested_region_id and requested_region_id != effective_region:
            return None, None, None
        return requested_branch_id, requested_district_id, effective_region

    return None, None, None
