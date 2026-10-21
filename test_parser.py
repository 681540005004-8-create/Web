# -*- coding: utf-8 -*-
import sys
import re
import uuid

day_map = {
    'จันทร์': 'Monday', 'จ.': 'Monday', 'mon': 'Monday', 'monday': 'Monday',
    'อังคาร': 'Tuesday', 'อ.': 'Tuesday', 'tue': 'Tuesday', 'tuesday': 'Tuesday',
    'พุธ': 'Wednesday', 'พ.': 'Wednesday', 'wed': 'Wednesday', 'wednesday': 'Wednesday',
    'พฤหัสบดี': 'Thursday', 'พฤหัส': 'Thursday', 'พฤ.': 'Thursday', 'thu': 'Thursday', 'thursday': 'Thursday',
    'ศุกร์': 'Friday', 'ศ.': 'Friday', 'fri': 'Friday', 'friday': 'Friday',
    'เสาร์': 'Saturday', 'ส.': 'Saturday', 'sat': 'Saturday', 'saturday': 'Saturday',
    'อาทิตย์': 'Sunday', 'อา.': 'Sunday', 'sun': 'Sunday', 'sunday': 'Sunday'
}

colors = ['indigo', 'sky', 'emerald', 'amber', 'purple', 'rose', 'teal']

def parse_schedule_text(text):
    if not text:
        return []

    lines = [l.strip() for l in text.split('\n') if l.strip()]
    extracted = []
    current_day = 'Monday'

    for i, line in enumerate(lines):
        # Update current_day if line is a day header
        for k, v in day_map.items():
            if re.search(r'^(วัน)?' + re.escape(k) + r'(:|\s|$)', line, re.IGNORECASE):
                current_day = v
                break

        time_match = re.search(r'(\d{1,2}[:.]\d{2})\s*[-–~ถึงto]\s*(\d{1,2}[:.]\d{2})', line)
        if time_match:
            s_time = time_match.group(1).replace('.', ':')
            e_time = time_match.group(2).replace('.', ':')
            if len(s_time.split(':')[0]) == 1: s_time = '0' + s_time
            if len(e_time.split(':')[0]) == 1: e_time = '0' + e_time

            # Context lines
            prev_lines = lines[max(0, i-3):i]
            next_lines = lines[i+1:min(len(lines), i+6)]

            # 1. Day determination
            line_day = current_day
            for pl in reversed(prev_lines):
                for k, v in day_map.items():
                    if re.search(r'(^|[\s,.\t])' + re.escape(k) + r'([\s,.\t:]|$)', pl, re.IGNORECASE):
                        line_day = v
                        break
            for k, v in day_map.items():
                if re.search(r'(^|[\s,.\t])' + re.escape(k) + r'([\s,.\t:]|$)', line, re.IGNORECASE):
                    line_day = v
                    break

            # 2. Code determination
            code = None
            code_pattern = r'([A-Za-z]{2,5}\s*\d{3,4}[A-Za-z]?|\b\d{6,8}\b)'
            code_match = re.search(code_pattern, line)
            if code_match:
                code = code_match.group(1).replace(' ', '').upper()
            else:
                for nl in next_lines:
                    cm = re.search(code_pattern, nl)
                    if cm:
                        code = cm.group(1).replace(' ', '').upper()
                        break
                if not code:
                    for pl in reversed(prev_lines):
                        cm = re.search(code_pattern, pl)
                        if cm:
                            code = cm.group(1).replace(' ', '').upper()
                            break
            if not code:
                code = 'COURSE'

            # 3. Room determination
            room = None
            room_pattern = r'(ENG[-\s]?\d+|LAB[-\s]?\d+|ROOM[-\s]?\d+|LIB[-\s]?\d+|IOT[-\s]?LAB|SEMINAR[-\s]?\d+|ห้อง\s*[\w\d]+|\b\d{3,4}\b|Online|Zoom)'
            rm = re.search(room_pattern, line, re.IGNORECASE)
            if rm:
                room = rm.group(1).strip()
            else:
                for nl in next_lines:
                    rm = re.search(room_pattern, nl, re.IGNORECASE)
                    if rm:
                        room = rm.group(1).strip()
                        break
            if not room:
                room = 'ห้องเรียน'

            # 4. Name determination
            name = ''
            temp = line
            temp = re.sub(r'(\d{1,2}[:.]\d{2})\s*[-–~ถึงto]\s*(\d{1,2}[:.]\d{2})', '', temp)
            if code_match:
                temp = temp.replace(code_match.group(0), '')
            for k in day_map.keys():
                temp = re.sub(r'(วัน)?' + re.escape(k), '', temp, flags=re.IGNORECASE)
            temp = re.sub(r'\d\(\d+-\d+-\d+\)', '', temp)
            temp = re.sub(r'(น\.|ห้อง|Room|Online|Zoom|[:|\-,])', ' ', temp, flags=re.IGNORECASE)
            if rm and room != 'ห้องเรียน':
                temp = temp.replace(room, '')
            clean_same_line = re.sub(r'\s+', ' ', temp).strip()

            if len(clean_same_line) >= 3:
                name = clean_same_line
            else:
                for nl in next_lines:
                    if code and (code in nl.replace(' ', '') or nl.replace(' ', '').startswith(code[:3])):
                        continue
                    if room and room in nl:
                        continue
                    if re.search(r'(\d{1,2}[:.]\d{2})', nl):
                        break
                    if any(k in nl.lower() for k in day_map.keys()):
                        continue
                    if re.search(r'^(Dr\.|Aj\.|ผศ\.|รศ\.|อ\.|อาจารย์|Committee)', nl):
                        continue
                    if len(nl) >= 3:
                        name = nl
                        break
            if not name:
                name = f'วิชา {code}'

            extracted.append({
                'id': f'c_up_{uuid.uuid4().hex[:6]}',
                'code': code,
                'name': name,
                'day': line_day,
                'start': s_time,
                'end': e_time,
                'room': room,
                'instructor': 'อาจารย์ผู้สอน',
                'color': colors[len(extracted) % len(colors)]
            })

    return extracted

if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    import pypdf
    reader = pypdf.PdfReader('static/sample_timetable.pdf')
    pdf_text = '\n'.join([p.extract_text() for p in reader.pages])
    res = parse_schedule_text(pdf_text)
    print(f'Parsed {len(res)} classes from sample_timetable.pdf:')
    for c in res:
        print(f"[{c['day']}] {c['start']}-{c['end']} | {c['code']} | {c['name']} | {c['room']}")
