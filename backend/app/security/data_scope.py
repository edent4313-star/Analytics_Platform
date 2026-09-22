"""
CRITICAL SECURITY MODULE: Organizational Data Scope Enforcement

This module determines what data a user is authorized to see based on their
access_level and assigned org unit. It is the SINGLE source of truth for
data-level security.

Rules:
  HEAD_OFFICE  → No organizational restriction (subject to dashboard permissions)
  REGION       → Restricted to user's region_id
  DISTRICT     → Restricted to user's district_id (and its region)
  BRANCH       → Restricted to user's branch_id only

NEVER construct DataScope from user-supplied request parameters.
ALWAYS construct from the authenticated user object.
"""
from typing import Optional, TYPE_CHECKING
from app.database.data_access import DataScope

if TYPE_CHECKING:
    from app.models.user import User


def get_data_scope(user: "User") -> DataScope:
    """
    Build a DataScope from the authenticated user's profile.

    This is the authoritative scope used to inject WHERE clauses into every
    analytical query. It cannot be overridden by the frontend.
    """
    access_level = user.access_level

    if access_level == "HEAD_OFFICE":
        return DataScope(
            access_level="HEAD_OFFICE",
            region_ids=None,    # unrestricted
            district_ids=None,
            branch_ids=None,
        )
    elif access_level == "REGION":
        if not user.region_id:
            raise ValueError(f"User {user.id} has REGION access level but no region_id assigned")
        return DataScope(
            access_level="REGION",
            region_ids=[user.region_id],
            district_ids=None,   # all districts in region (resolved at query time)
            branch_ids=None,     # all branches in region (resolved at query time)
        )
    elif access_level == "DISTRICT":
        if not user.district_id:
            raise ValueError(f"User {user.id} has DISTRICT access level but no district_id assigned")
        return DataScope(
            access_level="DISTRICT",
            region_ids=[user.region_id] if user.region_id else None,
            district_ids=[user.district_id],
            branch_ids=None,     # all branches in district (resolved at query time)
        )
    elif access_level == "BRANCH":
        if not user.branch_id:
            raise ValueError(f"User {user.id} has BRANCH access level but no branch_id assigned")
        return DataScope(
            access_level="BRANCH",
            region_ids=[user.region_id] if user.region_id else None,
            district_ids=[user.district_id] if user.district_id else None,
            branch_ids=[user.branch_id],
        )
    else:
        # Unknown access level — deny all data
        raise ValueError(f"Unknown access_level: {access_level} for user {user.id}")


def validate_org_filter_request(
    requested_branch_id: Optional[int],
    requested_district_id: Optional[int],
    requested_region_id: Optional[int],
    scope: DataScope,
) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """
    Validate user-requested org filters against their authorized scope.
    Returns the effective (branch_id, district_id, region_id) that will
    actually be applied.

    Users may narrow their own scope (e.g., a Regional Manager can
    select a specific district). They can NEVER widen it.

    Returns (None, None, None) if the requested filter is out of scope
    and should be rejected with a 403 error.
    """
    if scope.is_unrestricted:
        # HEAD_OFFICE can request any org unit
        return requested_branch_id, requested_district_id, requested_region_id

    # BRANCH level: only their own branch allowed
    if scope.access_level == "BRANCH":
        effective_branch = scope.branch_ids[0] if scope.branch_ids else None
        if requested_branch_id and requested_branch_id != effective_branch:
            return None, None, None  # Attempted scope escalation
        return effective_branch, scope.district_ids[0] if scope.district_ids else None, scope.region_ids[0] if scope.region_ids else None

    # DISTRICT level: can select branches within their district only
    if scope.access_level == "DISTRICT":
        effective_district = scope.district_ids[0] if scope.district_ids else None
        if requested_district_id and requested_district_id != effective_district:
            return None, None, None  # Out of scope district
        return requested_branch_id, effective_district, scope.region_ids[0] if scope.region_ids else None

    # REGION level: can select districts/branches within their region only
    if scope.access_level == "REGION":
        effective_region = scope.region_ids[0] if scope.region_ids else None
        if requested_region_id and requested_region_id != effective_region:
            return None, None, None  # Out of scope region
        return requested_branch_id, requested_district_id, effective_region

    return None, None, None
