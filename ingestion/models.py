from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DisclosureCategory = Literal[
    "directorship", "paid_employment", "shareholding", "consultancy",
    "gift_hospitality", "foreign_travel", "land_property", "other",
]
SpendType = Literal[
    "domestic_travel", "international_travel", "constituency_allowance",
    "other",
]
JudicialStatus = Literal[
    "charge_pending", "acquitted", "convicted_appeal_pending",
    "convicted_final", "civil_matter",
]


class MPSeed(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=200)
    known_as: str | None = None
    chamber: Literal["na", "ncop"]
    party: str | None = None
    constituency: str | None = None
    portfolio: str | None = None
    term_start: date | None = None
    term_end: date | None = None
    official_profile_url: str | None = None


class DisclosureRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mp_full_name: str = Field(min_length=2)
    category: DisclosureCategory
    description: str | None = None
    counterparty: str | None = None
    value_zar: Decimal | None = Field(default=None, ge=0)
    period_start: date | None = None
    period_end: date | None = None


class SpendingRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mp_full_name: str = Field(min_length=2)
    spend_type: SpendType
    amount_zar: Decimal = Field(ge=0)
    period_start: date
    period_end: date
    department: str | None = None


class JudicialRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mp_full_name: str = Field(min_length=2)
    status: JudicialStatus
    case_number: str | None = None
    court: str | None = None
    summary_neutral: str | None = Field(default=None, max_length=2000)
    status_as_of: date


class ParsedDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str
    published_at: date | None = None
    mps: list[MPSeed] = Field(default_factory=list)
    disclosures: list[DisclosureRow] = Field(default_factory=list)
    spending: list[SpendingRow] = Field(default_factory=list)
    judicial: list[JudicialRow] = Field(default_factory=list)
