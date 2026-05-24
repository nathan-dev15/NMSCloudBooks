from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.client import ClientType, ClientSegment, CommunicationType


# ── ClientContact ────────────────────────────────────────────────────────────

class ClientContactBase(BaseModel):
    name:        str
    designation: Optional[str] = None
    email:       Optional[str] = None
    phone:       Optional[str] = None
    is_primary:  bool = False


class ClientContactCreate(ClientContactBase):
    pass


class ClientContactUpdate(BaseModel):
    name:        Optional[str] = None
    designation: Optional[str] = None
    email:       Optional[str] = None
    phone:       Optional[str] = None
    is_primary:  Optional[bool] = None


class ClientContactResponse(ClientContactBase):
    id:        int
    client_id: int

    model_config = {"from_attributes": True}


# ── ClientCommunication ───────────────────────────────────────────────────────

class CommunicationBase(BaseModel):
    comm_type:      CommunicationType
    subject:        str = Field(..., max_length=255)
    body:           Optional[str] = None
    outcome:        Optional[str] = None
    follow_up_date: Optional[str] = None


class CommunicationCreate(CommunicationBase):
    pass


class CommunicationResponse(CommunicationBase):
    id:           int
    client_id:    int
    logged_by_id: Optional[int] = None

    model_config = {"from_attributes": True}


# ── Client ────────────────────────────────────────────────────────────────────

class ClientBase(BaseModel):
    display_name:  str = Field(..., max_length=255)
    client_code:   Optional[str] = Field(None, max_length=50)
    client_type:   ClientType    = ClientType.COMPANY
    segment:       ClientSegment = ClientSegment.STANDARD
    is_active:     bool = True

    email:         Optional[str] = None
    phone:         Optional[str] = Field(None, max_length=20)
    alt_phone:     Optional[str] = Field(None, max_length=20)
    website:       Optional[str] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city:          Optional[str] = None
    state:         Optional[str] = None
    pincode:       Optional[str] = Field(None, max_length=10)
    country:       str = "India"

    gstin:         Optional[str] = Field(None, max_length=15)
    pan:           Optional[str] = Field(None, max_length=10)
    credit_limit:  Optional[float] = None
    credit_days:   Optional[int]   = None
    currency:      str = "INR"

    notes: Optional[str] = None
    tags:  list[str]     = []

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) != 15:
            raise ValueError("GSTIN must be exactly 15 characters")
        return v

    @field_validator("pan")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) != 10:
            raise ValueError("PAN must be exactly 10 characters")
        return v


class ClientCreate(ClientBase):
    contacts: list[ClientContactCreate] = []


class ClientUpdate(BaseModel):
    display_name:  Optional[str]          = None
    client_code:   Optional[str]          = None
    client_type:   Optional[ClientType]   = None
    segment:       Optional[ClientSegment] = None
    is_active:     Optional[bool]         = None

    email:         Optional[str] = None
    phone:         Optional[str] = None
    alt_phone:     Optional[str] = None
    website:       Optional[str] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city:          Optional[str] = None
    state:         Optional[str] = None
    pincode:       Optional[str] = None
    country:       Optional[str] = None

    gstin:         Optional[str]   = None
    pan:           Optional[str]   = None
    credit_limit:  Optional[float] = None
    credit_days:   Optional[int]   = None
    currency:      Optional[str]   = None

    notes: Optional[str]      = None
    tags:  Optional[list[str]] = None


class ClientResponse(ClientBase):
    id:                  int
    tenant_id:           int
    created_by_id:       Optional[int] = None
    outstanding_balance: float
    contacts:            list[ClientContactResponse] = []

    model_config = {"from_attributes": True}


class ClientListItem(BaseModel):
    id:                  int
    display_name:        str
    client_code:         Optional[str]
    client_type:         ClientType
    segment:             ClientSegment
    is_active:           bool
    email:               Optional[str]
    phone:               Optional[str]
    city:                Optional[str]
    outstanding_balance: float
    currency:            str

    model_config = {"from_attributes": True}


class PaginatedClients(BaseModel):
    items: list[ClientListItem]
    total: int
    page:  int
    size:  int
    pages: int
