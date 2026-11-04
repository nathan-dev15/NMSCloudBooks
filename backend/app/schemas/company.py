from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class CompanyCreate(BaseModel):
    name: str
    slug: str
    invoice_prefix: str
    invoice_starting_number: int
    email: EmailStr
    phone: str
    address: str
    gstin: str
    # Optional branding
    logo_url: str | None = None
    seal_url: str | None = None
    signature_url: str | None = None

    @field_validator("invoice_prefix")
    @classmethod
    def prefix_uppercase(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("invoice_starting_number")
    @classmethod
    def positive_start(cls, v: int) -> int:
        if v < 1:
            raise ValueError("invoice_starting_number must be >= 1")
        return v


class CompanyUpdate(BaseModel):
    name: str | None = None
    invoice_prefix: str | None = None
    invoice_starting_number: int | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    gstin: str | None = None
    logo_url: str | None = None
    seal_url: str | None = None
    signature_url: str | None = None
    is_active: bool | None = None

    @field_validator("invoice_prefix")
    @classmethod
    def prefix_uppercase(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v

    @field_validator("invoice_starting_number")
    @classmethod
    def positive_start(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("invoice_starting_number must be >= 1")
        return v


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_admin_id: int
    tenant_id: int
    name: str
    slug: str
    invoice_prefix: str
    invoice_starting_number: int
    email: str
    phone: str
    address: str
    gstin: str
    logo_url: str | None
    seal_url: str | None
    signature_url: str | None
    is_active: bool
