# -*- coding: utf-8 -*-
import sys
import io
import re
import uuid
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

engine = RapidOCR()

SCHEDULE_DAY_MAP = {
    'พฤหัสบดี': 'Thursday', 'พฤหัส': 'Thursday', 'พฤ.': 'Thursday', 'พฤ': 'Thursday',
    'จันทร์': 'Monday', 'จ.': 'Monday', 'จ': 'Monday',
    'อังคาร': 'Tuesday', 'อ.': 'Tuesday', 'อ': 'Tuesday',
    'พุธ': 'Wednesday', 'พ.': 'Wednesday', 'พ': 'Wednesday',
    'ศุกร์': 'Friday', 'ศ.': 'Friday', 'ศ': 'Friday',
    'เสาร์': 'Saturday', 'ส.': 'Saturday', 'ส': 'Saturday',
    'อาทิตย์': 'Sunday', 'อา.': 'Sunday', 'อา': 'Sunday',
    'thursday': 'Thursday', 'wednesday': 'Wednesday', 'tuesday': 'Tuesday', 'monday': 'Monday',
    'friday': 'Friday', 'saturday': 'Saturday', 'sunday': 'Sunday',
    'thu': 'Thursday', 'wed': 'Wednesday', 'tue': 'Tuesday', 'mon': 'Monday',
    'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday',
    'th': 'Thursday', 'we': 'Wednesday', 'tu': 'Tuesday', 'mo': 'Monday',
    'fr': 'Friday', 'sa': 'Saturday', 'su': 'Sunday'
}

SCHEDULE_COLORS = ['indigo', 'sky', 'emerald', 'amber', 'purple', 'rose', 'teal']

def extract_classes_from_image_bytes(img_bytes):
    """
    Extracts university course schedule directly from image bytes using RapidOCR ONNX.
    Supports both grid timetables (column/row headers) and list/table views.
    """
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        img_np = np.array(img)
        result, _ = engine(img_np)
    except Exception as e:
        print("RapidOCR image read exception:", e)
        return []

    if not result:
        return []

    # Clean text in each box: fix split codes like 'C PE381' or 'CPE 312'
    cleaned_boxes = []
    for box, text, score in result:
        t = re.sub(r'([A-Za-z]{1,4})\s+(\d{3,4})', r'\1\2', text)
        cx = (box[0][0] + box[2][0]) / 2
        cy = (box[0][1] + box[2][1]) / 2
        cleaned_boxes.append({'box': box, 'text': t, 'cx': cx, 'cy': cy})

    # 1. Check for day headers (Grid Timetable Detection)
    day_headers = []
    for item in cleaned_boxes:
        clean = re.sub(r'[^a-zA-Z\u0E00-\u0E7F]', '', item['text']).lower()
        for k, v in SCHEDULE_DAY_MAP.items():
            k_clean = re.sub(r'[^a-zA-Z\u0E00-\u0E7F]', '', k).lower()
            if k_clean and (clean == k_clean or (len(k_clean) >= 3 and clean.startswith(k_clean))):
                day_headers.append({'day': v, 'cx': item['cx'], 'cy': item['cy']})
                break

    distinct_days = set(d['day'] for d in day_headers)
    extracted = []

    # If at least 2 days found as headers along X axis (Grid table where columns are days)
    if len(distinct_days) >= 2:
        # Group text items by closest day column
        columns = {d['day']: [] for d in day_headers}
        min_header_y = min(d['cy'] for d in day_headers)

        for item in cleaned_boxes:
            cx, cy, text = item['cx'], item['cy'], item['text']
            # Ignore headers above day row
            if cy < min_header_y - 20:
                continue
            # Ignore the day header itself
            if any(abs(cx - d['cx']) < 35 and abs(cy - d['cy']) < 25 for d in day_headers):
                continue

            closest = min(day_headers, key=lambda d: abs(cx - d['cx']))
            columns[closest['day']].append((cy, text))

        for day, col_items in columns.items():
            col_items.sort(key=lambda x: x[0])
            col_classes = parse_column_items([it[1] for it in col_items], day)
            extracted.extend(col_classes)

    # 2. If grid parsing found nothing or very few, try sequential line parser
    if len(extracted) == 0:
        # Sort boxes top-to-bottom, left-to-right
        cleaned_boxes.sort(key=lambda b: (round(b['cy'] / 25) * 25, b['cx']))
        flat_lines = [b['text'] for b in cleaned_boxes]
        extracted = parse_flat_schedule_lines(flat_lines)

    return extracted

def parse_column_items(lines, day):
    """
    Parses sequential text lines under a specific day column in a grid timetable.
    """
    classes = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Look for time pattern
        tm = re.search(r'(\d{1,2}[:.]\d{2})\s*[-–~ถึงto]\s*(\d{1,2}[:.]\d{2})', line)
        if tm:
            s_time = tm.group(1).replace('.', ':')
            e_time = tm.group(2).replace('.', ':')
            if len(s_time.split(':')[0]) == 1: s_time = '0' + s_time
            if len(e_time.split(':')[0]) == 1: e_time = '0' + e_time

            prev_lines = lines[max(0, i-2):i]
            next_lines = lines[i+1:min(len(lines), i+3)]

            # Course Code
            code = None
            code_pat = r'([A-Za-z]{2,5}\d{3,4}[A-Za-z]?|\b\d{6,8}\b)'
            name = ''
            for pl in reversed(prev_lines):
                cm = re.search(code_pat, pl)
                if cm:
                    code = cm.group(1).upper()
                    rem = pl.replace(cm.group(0), '')
                    rem = re.sub(r'[:|\-,()]', ' ', rem).strip()
                    if len(rem) >= 2:
                        name = rem
                    break

            if not code:
                # check line itself
                cm = re.search(code_pat, line)
                if cm:
                    code = cm.group(1).upper()
                else:
                    for nl in next_lines:
                        cm = re.search(code_pat, nl)
                        if cm:
                            code = cm.group(1).upper()
                            break

            if not code:
                code = f"CPE{len(classes)+1}00"

            # Room
            room = 'ห้องเรียน'
            room_pat = r'(ENG[-\s]?\d+|LAB[-\s]?\d+|ROOM[-\s]?\d+|LIB[-\s]?\d+|IOT[-\s]?LAB|SEMINAR[-\s]?\d+|ห้อง\s*[\w\d]+|\b\d{3,4}\b|Online|Zoom)'
            for nl in next_lines:
                rm = re.search(room_pat, nl, re.IGNORECASE)
                if rm:
                    room = rm.group(1).strip()
                    break

            if not name:
                # check next lines for name
                for nl in next_lines:
                    if (code and code in nl) or (room and room in nl):
                        continue
                    if len(nl) >= 2:
                        name = nl
                        break
            if not name:
                name = f"วิชา {code}"

            classes.append({
                'id': f'c_up_{uuid.uuid4().hex[:6]}',
                'code': code,
                'name': name,
                'day': day,
                'start': s_time,
                'end': e_time,
                'room': room,
                'instructor': 'อาจารย์ผู้สอน',
                'color': SCHEDULE_COLORS[len(classes) % len(SCHEDULE_COLORS)]
            })
        i += 1
    return classes

def parse_flat_schedule_lines(lines):
    """
    Parses sequential text lines from table or list format.
    """
    extracted = []
    current_day = 'Monday'

    for i, line in enumerate(lines):
        # Day header detection
        for k, v in SCHEDULE_DAY_MAP.items():
            if re.search(r'^(วัน)?' + re.escape(k) + r'(:|\s|$)', line, re.IGNORECASE):
                current_day = v
                break

        tm = re.search(r'(\d{1,2}[:.]\d{2})\s*[-–~ถึงto]\s*(\d{1,2}[:.]\d{2})', line)
        if tm:
            s_time = tm.group(1).replace('.', ':')
            e_time = tm.group(2).replace('.', ':')
            if len(s_time.split(':')[0]) == 1: s_time = '0' + s_time
            if len(e_time.split(':')[0]) == 1: e_time = '0' + e_time

            prev_lines = lines[max(0, i-3):i]
            next_lines = lines[i+1:min(len(lines), i+4)]

            line_day = current_day
            for pl in reversed(prev_lines):
                for k, v in SCHEDULE_DAY_MAP.items():
                    if re.search(r'(^|[\s,.\t])' + re.escape(k) + r'([\s,.\t:]|$)', pl, re.IGNORECASE):
                        line_day = v
                        break
            for k, v in SCHEDULE_DAY_MAP.items():
                if re.search(r'(^|[\s,.\t])' + re.escape(k) + r'([\s,.\t:]|$)', line, re.IGNORECASE):
                    line_day = v
                    break

            code_pat = r'([A-Za-z]{2,5}\s*\d{3,4}[A-Za-z]?|\b\d{6,8}\b)'
            cm = re.search(code_pat, line)
            code = cm.group(1).replace(' ', '').upper() if cm else None
            if not code:
                for pl in reversed(prev_lines):
                    cm = re.search(code_pat, pl)
                    if cm:
                        code = cm.group(1).replace(' ', '').upper()
                        break
            if not code:
                for nl in next_lines:
                    cm = re.search(code_pat, nl)
                    if cm:
                        code = cm.group(1).replace(' ', '').upper()
                        break
            if not code:
                code = 'COURSE'

            room_pat = r'(ENG[-\s]?\d+|LAB[-\s]?\d+|ROOM[-\s]?\d+|LIB[-\s]?\d+|IOT[-\s]?LAB|SEMINAR[-\s]?\d+|ห้อง\s*[\w\d]+|\b\d{3,4}\b|Online|Zoom)'
            rm = re.search(room_pat, line, re.IGNORECASE)
            room = rm.group(1).strip() if rm else None
            if not room:
                for nl in next_lines:
                    rm = re.search(room_pat, nl, re.IGNORECASE)
                    if rm:
                        room = rm.group(1).strip()
                        break
            if not room:
                room = 'ห้องเรียน'

            # Name
            temp = line
            temp = re.sub(r'(\d{1,2}[:.]\d{2})\s*[-–~ถึงto]\s*(\d{1,2}[:.]\d{2})', '', temp)
            if cm:
                temp = temp.replace(cm.group(0), '')
            for k in SCHEDULE_DAY_MAP.keys():
                temp = re.sub(r'(วัน)?' + re.escape(k), '', temp, flags=re.IGNORECASE)
            temp = re.sub(r'\d\(\d+-\d+-\d+\)', '', temp)
            temp = re.sub(r'(น\.|ห้อง|Room|Online|Zoom|[:|\-,])', ' ', temp, flags=re.IGNORECASE)
            if rm and room != 'ห้องเรียน':
                temp = temp.replace(room, '')
            name = re.sub(r'\s+', ' ', temp).strip()
            if not name or len(name) < 2:
                for nl in next_lines:
                    if code and code in nl.replace(' ', ''): continue
                    if room and room in nl: continue
                    if len(nl) >= 2:
                        name = nl
                        break
            if not name:
                name = f"วิชา {code}"

            extracted.append({
                'id': f'c_up_{uuid.uuid4().hex[:6]}',
                'code': code,
                'name': name,
                'day': line_day,
                'start': s_time,
                'end': e_time,
                'room': room,
                'instructor': 'อาจารย์ผู้สอน',
                'color': SCHEDULE_COLORS[len(extracted) % len(SCHEDULE_COLORS)]
            })

    return extracted

if __name__ == '__main__':
    with open('static/sample_timetable.png', 'rb') as f:
        res = extract_classes_from_image_bytes(f.read())
    print(f"Total extracted: {len(res)}")
    for c in res:
        print(f"[{c['day']}] {c['start']}-{c['end']} | {c['code']} | {c['name']} | {c['room']}")
