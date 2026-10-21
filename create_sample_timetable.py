import os
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

os.makedirs('static', exist_ok=True)

# 1. Generate Sample Image Timetable (PNG)
w, h = 1000, 600
img = Image.new('RGB', (w, h), color='#0f172a')
draw = ImageDraw.Draw(img)

# Draw Title Header
draw.rectangle([(0, 0), (w, 70)], fill='#1e293b')
draw.text((30, 22), "FACULTY OF ENGINEERING - COMPUTER ENGINEERING TIMETABLE (TERM 1)", fill='#ffffff')

# Draw Days and Grid
days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
col_w = (w - 100) // len(days)

# Draw Day Headers
for i, day in enumerate(days):
    x = 100 + i * col_w
    draw.rectangle([(x, 75), (x + col_w - 6, 110)], fill='#334155')
    draw.text((x + 15, 86), day, fill='#f8fafc')

# Draw Classes Cards
sample_boxes = [
    # (day_idx, start_y, height, text_code, text_name, text_time, room, fill_color)
    (0, 130, 100, "CPE312", "Computer Networks (Lec)", "09:00 - 12:00", "ENG-402", '#4f46e5'),
    (0, 240, 100, "CPE312L", "Computer Networks Lab", "13:00 - 16:00", "LAB-501", '#4338ca'),
    (1, 140, 90, "CPE324", "Database Systems", "09:30 - 12:00", "ENG-305", '#0284c7'),
    (1, 250, 70, "CPE381", "Technical English", "13:30 - 15:30", "LIB-201", '#d97706'),
    (2, 130, 100, "CPE223", "Data Structures", "09:00 - 12:00", "ENG-502", '#7c3aed'),
    (2, 260, 95, "CPE342L", "OS Lab (Unix/C)", "14:00 - 17:00", "LAB-404", '#059669'),
    (3, 150, 75, "CPE491", "Senior Project Seminar", "10:00 - 12:00", "SEMINAR-1", '#e11d48'),
    (3, 240, 100, "CPE355", "Software Engineering", "13:00 - 16:00", "ENG-408", '#2563eb'),
    (4, 130, 100, "CPE361", "Embedded Systems & IoT", "09:00 - 12:00", "IOT-LAB", '#0d9488'),
]

for d_idx, y, height, code, name, t_str, rm, bg in sample_boxes:
    x = 100 + d_idx * col_w
    draw.rectangle([(x, y), (x + col_w - 6, y + height)], fill=bg)
    draw.text((x + 10, y + 8), f"{code}: {name}", fill='#ffffff')
    draw.text((x + 10, y + 32), f"Time: {t_str}", fill='#cbd5e1')
    draw.text((x + 10, y + 54), f"Room: {rm}", fill='#cbd5e1')

img.save('static/sample_timetable.png')
print("Created static/sample_timetable.png")

# 2. Generate Sample PDF Timetable
pdf_filename = 'static/sample_timetable.pdf'
doc = SimpleDocTemplate(pdf_filename, pagesize=landscape(letter), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
styles = getSampleStyleSheet()

data = [
    ["Day", "Time", "Course Code", "Course Title", "Room", "Instructor"],
    ["Monday", "09:00 - 12:00", "CPE312", "Computer Networks (Lecture)", "ENG-402", "Dr. Somchai"],
    ["Monday", "13:00 - 16:00", "CPE312L", "Computer Networks Lab", "LAB-501", "Aj. Parichat"],
    ["Tuesday", "09:30 - 12:00", "CPE324", "Database Systems & Design", "ENG-305", "Asst.Prof. Narumon"],
    ["Tuesday", "13:30 - 15:30", "CPE381", "Technical Communication", "LIB-201", "Aj. Michael"],
    ["Wednesday", "09:00 - 12:00", "CPE223", "Data Structures & Algorithms", "ENG-502", "Assoc.Prof. Chanwit"],
    ["Wednesday", "14:00 - 17:00", "CPE342L", "Operating Systems Lab", "LAB-404", "Dr. Anan"],
    ["Thursday", "10:00 - 12:00", "CPE491", "Senior Project Seminar", "SEMINAR-1", "Committee"],
    ["Thursday", "13:00 - 16:00", "CPE355", "Software Engineering & Agile", "ENG-408", "Aj. Thanakrit"],
    ["Friday", "09:00 - 12:00", "CPE361", "Embedded Systems & IoT", "IOT-LAB", "Asst.Prof. Surachai"]
]

t = Table(data, colWidths=[90, 100, 90, 220, 90, 130])
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
]))

story = [
    Paragraph("<b>UNIVERSITY REGISTRATION SYSTEM - STUDENT TIMETABLE</b>", styles['Heading2']),
    Spacer(1, 10),
    t
]
doc.build(story)
print("Created static/sample_timetable.pdf")
