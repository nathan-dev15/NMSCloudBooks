from fastapi import APIRouter
from sqlalchemy import text
from app.core.deps import DB, get_current_user, CurrentUser
from fastapi import Depends

router = APIRouter(prefix="/business-types", tags=["Business Types"])


@router.get("")
async def list_business_types(
    db: DB,
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await db.execute(text(
        "SELECT id, business_type_name, description "
        "FROM user_business_types WHERE is_active = true ORDER BY business_type_name"
    ))
    rows = result.fetchall()
    return [{"id": r[0], "name": r[1], "description": r[2]} for r in rows]
