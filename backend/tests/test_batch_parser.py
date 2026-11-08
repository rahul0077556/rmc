import os
import io
import pypdf
import pytest
from backend.app.services.batch_report_parser import BatchReportParserService

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")

def test_parse_rahul2_pdf():
    pdf_path = os.path.join(FIXTURES_DIR, "Rahul2.pdf")
    assert os.path.exists(pdf_path), "Rahul2.pdf fixture missing"

    reader = pypdf.PdfReader(pdf_path)
    raw_text = "\n".join(p.extract_text() or "" for p in reader.pages)
    parsed = BatchReportParserService.parse_text_or_ocr(raw_text)

    assert parsed["isReadable"] is True
    assert parsed["docketNumber"] == "5812"
    assert parsed["customerName"] == "Rahul wagh cop"
    assert parsed["siteName"] == "IT PARK"
    assert parsed["truckNumber"] == "MH40DC4288"
    assert parsed["driverName"] == "VIKASH"
    assert parsed["ticketQtyCum"] == 5.0
    assert parsed["wcRatio"] == 0.39
    assert len(parsed["materials"]) >= 8

    # Verify material names and weights
    mat_names = [m["name"] for m in parsed["materials"]]
    assert "R SAND" in mat_names
    assert "M SAND" in mat_names
    assert "CEMENT 1" in mat_names
    assert "FLYASH" in mat_names
    assert "WATER" in mat_names

    # Verify mathematical balance
    assert len(parsed["cycles"]) == 4
    cycle_sum = sum(c["totalKg"] for c in parsed["cycles"])
    assert abs(cycle_sum - parsed["totalWeightKg"]) < 0.5
    assert parsed["isVerified"] is True

def test_parse_docket_5703_pdf():
    pdf_path = os.path.join(FIXTURES_DIR, "Batch Delivery Report - Docket 5703.pdf")
    assert os.path.exists(pdf_path), "Docket 5703.pdf fixture missing"

    reader = pypdf.PdfReader(pdf_path)
    raw_text = "\n".join(p.extract_text() or "" for p in reader.pages)
    parsed = BatchReportParserService.parse_text_or_ocr(raw_text)

    assert parsed["isReadable"] is True
    assert parsed["docketNumber"] == "5703"
    assert parsed["customerName"] == "LIGHT HOUSE SYSTEM"
    assert parsed["siteName"] == "IT PARK"
    assert parsed["truckNumber"] == "MH40DC3964"
    assert parsed["driverName"] == "VIKASH"
    assert parsed["ticketQtyCum"] == 5.0
    assert parsed["wcRatio"] == 0.39

    # Verify cycle sum equals total actual
    assert len(parsed["cycles"]) == 4
    cycle_sum = sum(c["totalKg"] for c in parsed["cycles"])
    assert abs(cycle_sum - parsed["totalWeightKg"]) < 0.5
    assert parsed["isVerified"] is True

def test_parse_industry_mixes_pdf():
    pdf_path = os.path.join(FIXTURES_DIR, "RMC Batch Delivery Report - 4 Industry Mixes.pdf")
    assert os.path.exists(pdf_path), "4 Industry Mixes.pdf fixture missing"

    reader = pypdf.PdfReader(pdf_path)

    # Page 1: Godrej M40 HPC GGBS+Silica
    p1_text = reader.pages[0].extract_text()
    p1 = BatchReportParserService.parse_text_or_ocr(p1_text)
    assert p1["docketNumber"] == "6104"
    assert "GODREJ" in p1["customerName"].upper()
    assert p1["truckNumber"] == "MH40BG9102"
    assert p1["driverName"] == "RAMESHWAR K."
    assert p1["ticketQtyCum"] == 6.0
    assert p1["wcRatio"] == 0.32
    m1_names = [m["name"] for m in p1["materials"]]
    assert "CRUSHED SAND" in m1_names
    assert "OPC 53" in m1_names
    assert "GGBS" in m1_names
    assert "SILICA FUME" in m1_names

    # Page 2: L&T PQC M40 Fiber Reinforced
    p2_text = reader.pages[1].extract_text()
    p2 = BatchReportParserService.parse_text_or_ocr(p2_text)
    assert p2["docketNumber"] == "6105"
    assert "L&T" in p2["customerName"].upper()
    assert p2["truckNumber"] == "MH40CD5519"
    assert p2["ticketQtyCum"] == 6.0
    assert p2["wcRatio"] == 0.36
    m2_names = [m["name"] for m in p2["materials"]]
    assert "RIVER SAND" in m2_names
    assert "32 MM PAVING" in m2_names
    assert "OPC 43" in m2_names

    # Page 3: Shapoorji M10 Lean
    p3_text = reader.pages[2].extract_text()
    p3 = BatchReportParserService.parse_text_or_ocr(p3_text)
    assert p3["docketNumber"] == "6106"
    assert "SHAPOORJI" in p3["customerName"].upper()
    assert p3["truckNumber"] == "MH40DC1180"
    assert p3["ticketQtyCum"] == 6.0

def test_empty_or_unreadable_file_handling():
    parsed = BatchReportParserService.parse_text_or_ocr("")
    assert parsed["isReadable"] is False
    assert "could not be parsed" in parsed["error"].lower()
    assert len(parsed["materials"]) == 0
    assert parsed["isVerified"] is False

