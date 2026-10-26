import json
from datetime import datetime
from decimal import Decimal
from ..errors import ParserSpecGap
from ..models import ParsedDocument, TenderRow
from .base import PARSER_VERSION_PREFIX, BaseParser


class TreasuryEtendersParser(BaseParser):
    source_id = "treasury_etenders"

    @property
    def parser_version(self) -> str:
        return f"{PARSER_VERSION_PREFIX}+{self.source_id}"

    def parse(self, *, content: bytes, content_type: str, fetched_url: str) -> ParsedDocument:
        try:
            data = json.loads(content)
        except Exception as e:
            raise ParserSpecGap(f"Invalid JSON: {e}")

        tenders = []
        for r in data.get("releases", []):
            try:
                awards = r.get("awards", [])
                if not awards or not awards[0].get("suppliers"):
                    continue
                winning_company = awards[0]["suppliers"][0].get("name")
                if not winning_company:
                    continue

                tender_obj = r.get("tender", {})
                amount = tender_obj.get("value", {}).get("amount")
                award_date = None
                award_date_str = awards[0].get("date")
                if award_date_str:
                    try:
                        award_date = datetime.fromisoformat(award_date_str.replace("Z", "+00:00")).date()
                    except ValueError:
                        pass

                tenders.append(TenderRow(
                    ocid=r["ocid"],
                    title=tender_obj.get("title", "Unknown"),
                    department=r.get("buyer", {}).get("name"),
                    winning_company=winning_company,
                    amount_zar=Decimal(str(amount)) if amount is not None else None,
                    award_date=award_date,
                ))
            except Exception:
                continue

        return ParsedDocument(source_id=self.source_id, tenders=tenders)
