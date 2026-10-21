import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf(filename, title, course, deadline, instructions, criteria):
    doc = SimpleDocTemplate(filename, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=10
    )
    
    meta_style = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor('#475569')
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#2563eb'),
        spaceBefore=12,
        spaceAfter=6
    )

    story = []
    story.append(Paragraph(f"<b>DEPARTMENT OF COMPUTER ENGINEERING</b>", meta_style))
    story.append(Paragraph(f"Course: {course}", meta_style))
    story.append(Paragraph(f"Deadline: {deadline}", meta_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Assignment Description & Objective", h2_style))
    for p in instructions:
        story.append(Paragraph(p, body_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("2. Grading & Evaluation Criteria", h2_style))
    for c in criteria:
        story.append(Paragraph(f"• {c}", body_style))

    story.append(Spacer(1, 15))
    story.append(Paragraph("<i>Note: Please deconstruct this assignment into daily actionable tasks using TaskFlow AI to avoid procrastination and burnout.</i>", meta_style))

    doc.build(story)
    print(f"Generated {filename}")

os.makedirs('static/sample_assignments', exist_ok=True)

# Sample 1: Socket Programming Lab
generate_pdf(
    'static/sample_assignments/CPE312_Lab4_Socket_Server.pdf',
    'Lab 4: Multi-threaded TCP Socket Chat Server',
    'CPE312 Computer Networks',
    'October 25, 2026, 23:59',
    [
        "In this assignment, students are required to implement a robust multi-threaded or I/O multiplexed TCP chat server and client in C or Python.",
        "The server must handle at least 5 concurrent connected users without blocking, broadcast messages to all active channels, and support user commands (/list, /private, /quit).",
        "Students must capture TCP packet flows using Wireshark to verify the three-way handshake (SYN, SYN-ACK, ACK) and connection termination (FIN-ACK).",
        "Deliverables include source code, Makefile, and a technical PDF report containing packet analysis diagrams."
    ],
    [
        "Correct TCP Protocol Implementation & Concurrency (40%)",
        "Packet Trace Analysis with Wireshark (30%)",
        "Clean Code Structure & Robust Error Handling (15%)",
        "Documentation & Lab Report Quality (15%)"
    ]
)

# Sample 2: Database Systems Project
generate_pdf(
    'static/sample_assignments/CPE324_Database_Design.pdf',
    'Project Phase 1: E-Commerce Relational Database Design & 3NF',
    'CPE324 Database Systems',
    'October 28, 2026, 17:00',
    [
        "Design a comprehensive relational schema for a modern multi-vendor e-commerce platform.",
        "Requirements: 1) Construct an Entity-Relationship (ER) diagram with at least 8 entities (Users, Products, Orders, OrderItems, Payments, Categories, Reviews, Shipments).",
        "2) Perform rigorous Database Normalization from 1NF to 3NF, explicitly demonstrating functional dependency closures.",
        "3) Write standard SQL DDL creation scripts with primary and foreign key constraints, indexes, and test data insertion queries."
    ],
    [
        "ER Diagram completeness and business logic coverage (35%)",
        "Mathematical rigor in 3NF Normalization proofs (35%)",
        "Valid SQL DDL and query performance execution (30%)"
    ]
)

# Sample 3: OS Process Scheduler
generate_pdf(
    'static/sample_assignments/CPE342_OS_Scheduler.pdf',
    'Mini-Project: CPU Scheduling Algorithms Simulation (FCFS, SJF, RR)',
    'CPE342 Operating Systems',
    'November 02, 2026, 23:59',
    [
        "Build a discrete-event CPU scheduling simulator comparing First-Come First-Served (FCFS), Shortest Job First (SJF), and Round Robin (RR) algorithms.",
        "The simulator should read process arrival times and burst times from a CSV file, compute average waiting time, turnaround time, and output a visual ASCII Gantt chart.",
        "Analyze the impact of different time quantum values on Round Robin context switching overhead."
    ],
    [
        "Algorithm implementation correctness (45%)",
        "Simulation metrics computation & Gantt chart output (30%)",
        "Comparative experimental report (25%)"
    ]
)
