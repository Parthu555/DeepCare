"""
PDF Report Generation Service using ReportLab.
Generates professional medical reports stored in S3.
"""
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def generate_report_pdf(report, doctor, patient) -> Optional[bytes]:
    """
    Generate a professional medical PDF report.
    Returns PDF bytes or None on failure.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            Paragraph, Spacer, SimpleDocTemplate, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        teal = colors.HexColor("#0D9488")
        dark = colors.HexColor("#1E293B")
        gray = colors.HexColor("#64748B")

        title_style = ParagraphStyle(
            "title",
            parent=styles["Title"],
            textColor=teal,
            fontSize=22,
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "subtitle",
            parent=styles["Normal"],
            textColor=gray,
            fontSize=11,
            spaceAfter=2,
        )
        section_style = ParagraphStyle(
            "section",
            parent=styles["Heading2"],
            textColor=teal,
            fontSize=12,
            spaceBefore=12,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "body",
            parent=styles["Normal"],
            textColor=dark,
            fontSize=10,
            spaceAfter=4,
        )
        small_style = ParagraphStyle(
            "small",
            parent=styles["Normal"],
            textColor=gray,
            fontSize=8,
        )

        story = []

        # Header
        story.append(Paragraph("DeepCare", title_style))
        story.append(Paragraph("Cloud-Based Intelligent Healthcare Platform", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=2, color=teal))
        story.append(Spacer(1, 0.3 * cm))

        # Report Title
        story.append(Paragraph(f"<b>{report.title}</b>", section_style))
        story.append(Paragraph(f"Report ID: {report.report_id} &nbsp;|&nbsp; Type: {report.report_type.capitalize()}", body_style))
        story.append(Spacer(1, 0.3 * cm))

        # Patient & Doctor info table
        patient_name = f"{patient.first_name} {patient.last_name}" if patient else "N/A"
        patient_id = patient.patient_id if patient else "N/A"
        doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "N/A"
        specialization = doctor.specialization if doctor else "N/A"
        approved_date = (report.approved_at or datetime.utcnow()).strftime("%d %b %Y, %H:%M")

        info_data = [
            ["Patient Name", patient_name, "Report Date", approved_date],
            ["Patient ID", patient_id, "Attending Physician", doctor_name],
            ["Report Status", report.status.upper(), "Specialization", specialization],
        ]
        info_table = Table(info_data, colWidths=[4 * cm, 7 * cm, 4 * cm, 7 * cm])
        info_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F0FDFA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F0FDFA")),
            ("TEXTCOLOR", (0, 0), (0, -1), teal),
            ("TEXTCOLOR", (2, 0), (2, -1), teal),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.5 * cm))

        # Clinical Sections
        def add_section(title: str, content: Optional[str]):
            if content:
                story.append(Paragraph(title, section_style))
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
                story.append(Paragraph(content, body_style))
                story.append(Spacer(1, 0.2 * cm))

        add_section("Clinical Summary", report.summary)
        add_section("Clinical Findings", report.clinical_findings)
        add_section("Recommendations", report.recommendations)

        if report.ai_analysis_included:
            story.append(Paragraph("AI-Assisted Analysis Note", section_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
            story.append(Paragraph(
                "<i>This report incorporates AI-assisted analysis output as clinical decision support. "
                "AI predictions are not a substitute for professional medical diagnosis. "
                "All findings have been reviewed and approved by the attending physician.</i>",
                body_style
            ))
            story.append(Spacer(1, 0.2 * cm))

        # Footer disclaimer
        story.append(Spacer(1, cm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0")))
        story.append(Paragraph(
            "CONFIDENTIAL MEDICAL RECORD — This document is intended solely for the named patient. "
            "Unauthorized disclosure is prohibited. DeepCare is a clinical decision support platform "
            "and does not replace professional medical advice.",
            small_style,
        ))

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        logger.warning("ReportLab not installed. PDF generation disabled.")
        return None
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        return None
