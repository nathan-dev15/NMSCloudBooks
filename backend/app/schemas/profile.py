import re
from pydantic import BaseModel, field_validator, model_validator


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    business_type_id: int | None = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Full name cannot be blank")
            if len(v) < 2:
                raise ValueError("Name must be at least 2 characters")
            if len(v) > 100:
                raise ValueError("Name cannot exceed 100 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must include at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Must include at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Must include at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Must include at least one special character")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self
