from datetime import datetime, timezone
from backend.app.extensions import db
from backend.app.models.models import Sequence

def get_next_sequence(seq_name: str, prefix: str) -> str:
    """
    Generate next concurrency-safe sequence string like PO-2026-0001.
    Locks row using with_for_update or creates new entry for current year.
    """
    year = datetime.now(timezone.utc).year
    seq = (
        Sequence.query
        .filter_by(name=seq_name, year=year)
        .with_for_update()
        .first()
    )
    if not seq:
        seq = Sequence(name=seq_name, year=year, last_value=0)
        db.session.add(seq)
        db.session.flush()

    seq.last_value += 1
    db.session.flush()
    return f"{prefix}-{year}-{seq.last_value:04d}"
