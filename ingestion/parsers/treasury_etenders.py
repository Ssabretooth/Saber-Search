import json
import logging
from datetime import datetime
from decimal import Decimal
from ..errors import ParserSpecGap
from ..models import ParsedDocument, TenderRow
from .base import PARSER_VERSION_PREFIX, BaseParser

log = logging.getLogger("publikeye.ingestion")


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

        releases = data.get("Releases") or data.get("releases") or []
        tenders = []
        skipped = 0
        for r in releases:
            ocid = r.get("ocid", "<no-ocid>")
            try:
                awards = r.get("awards", [])
                if not awards or not awards[0].get("suppliers"):
                    continue
                winning_company = awards[0]["suppliers"][0].get("name") or awards[0]["suppliers"][0].get("Name")
                if not winning_company:
                    continue

                tender_obj = r.get("tender", {})
                amount = (awards[0].get("value") or {}).get("amount")
                if amount is None:
                    amount = (tender_obj.get("value") or {}).get("amount")
                award_date = None
                award_date_str = awards[0].get("date") or r.get("date")
                if award_date_str:
                    try:
                        award_date = datetime.fromisoformat(award_date_str.replace("Z", "+00:00")).date()
                    except ValueError:
                        log.debug("etenders: unparseable date %r on ocid=%s", award_date_str, ocid)

                tenders.append(TenderRow(
                    ocid=r["ocid"],
                    title=tender_obj.get("title", "Unknown"),
                    department=r.get("buyer", {}).get("name"),
                    winning_company=winning_company,
                    amount_zar=Decimal(str(amount)) if amount is not None else None,
                    award_date=award_date,
                ))
            except Exception as exc:
                skipped += 1
                log.warning("etenders: skipping record ocid=%s — %s: %s", ocid, type(exc).__name__, exc)
                continue

        if skipped:
            log.warning("etenders: skipped %d/%d records due to parse errors", skipped, len(releases))

        return ParsedDocument(source_id=self.source_id, tenders=tenders)
