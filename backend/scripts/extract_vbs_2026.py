"""Source-specific, review-first adapter for the supplied VBS 2026 PDFs.

Requires pdfplumber. Writes a private import package, never modifies the PDFs.
Dates are user-confirmed, not inferred from the weekday-only attendance sheet.
Vector checkbox shapes are read explicitly; text extraction alone misses ticks.
"""
import argparse
import collections
import datetime
import hashlib
import json
import logging
import os
from pathlib import Path
import re

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)
START = datetime.date(2026, 8, 24)
DROP = [3, 4, 6, 7, 8, 9]
PICKUP = [23, 24, 25, 27, 28, 29]


def text_cell(page, table, header, index, y):
    """Read the actual merged cell containing a row, without forward-filling."""
    cell = header[index]
    if not cell:
        return ""
    x = (cell[0] + cell[2]) / 2
    candidates = [c for c in table.cells if c[0] < x < c[2] and c[1] <= y < c[3]]
    if len(candidates) != 1:
        return ""
    # A merged cell starts in one field; never copy an address or contact name
    # into the adjacent phone field merely because it spans that column.
    if candidates[0][0] < cell[0] - .05:
        return ""
    return " ".join((page.crop(candidates[0]).extract_text() or "").split())


def checkbox(page, bounds):
    x0, y0, x1, y1 = bounds
    squares = [c for c in page.curves if abs(c["width"]-4.1252) < .05
               and abs(c["height"]-4.1252) < .05
               and x0 <= (c["x0"]+c["x1"])/2 <= x1
               and y0 <= (c["top"]+c["bottom"])/2 <= y1]
    if len(squares) != 1:
        return None
    square = squares[0]
    return any(abs(c["width"]-3.1583) < .05 and abs(c["height"]-2.3507) < .05
               and square["x0"] <= c["x0"] <= c["x1"] <= square["x1"]
               and square["top"] <= c["top"] <= c["bottom"] <= square["bottom"]
               for c in page.curves)


def campus_code(raw):
    compact = re.sub(r"[^a-z]", "", raw.lower())
    for key, code in [("wuse","PETRA-WUSE"),("kubwa","PETRA-KUBWA"),
                      ("lugbe","PETRA-LUGBE"),("apo","PETRA-APO"),
                      ("mararaba","PETRA-MARARABA")]:
        if key in compact:
            return code
    return None  # "Abuja" alone does not identify a campus.


def attendance(path):
    rows = []
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages[:2], 1):
            table = page.find_tables()[0]
            header = table.rows[0].cells
            for visual_index, record in enumerate(table.rows[1:], 1):
                first = record.cells[0]
                if not first:
                    continue
                name = " ".join((page.crop(first).extract_text() or "").split())
                if not name:
                    continue
                y = (first[1] + first[3])/2
                def cell(i):
                    if i in (1,2):
                        return " ".join((page.crop((header[i][0],first[1],header[i][2],first[3])).extract_text() or "").split())
                    return text_cell(page, table, header, i, y)
                mark = lambda i: checkbox(page, (header[i][0],first[1],header[i][2],first[3]))
                age_raw = cell(2)
                age_match = re.fullmatch(r"(\d{1,2})(\+)?",age_raw)
                gender = {"male":"MALE","female":"FEMALE"}.get(cell(1).lower())
                row = {"sourceKey":f"vbs2026-attendance-p{page_number}-r{visual_index}",
                       "sourcePage":page_number,"sourceRow":visual_index,"name":name,
                       "age":int(age_match[1]) if age_match else None,
                       "ageQualifier":"+" if age_match and age_match[2] else None,
                       "ageRaw":age_raw,"dateOfBirth":None,"gender":gender,
                       "guardianName":cell(10) or None,"guardianPhone":cell(11) or None,
                       "alternatePhone":cell(12) or None,"homeAddress":cell(13) or None,
                       "emergencyPhone":cell(15) or None,"careNotes":cell(18) or None,
                       "homeCampusRaw":cell(21) or None,"homeCampusCode":campus_code(cell(21)),
                       "food":mark(30),"scholarship":None,"contacts":[],"days":[]}
                scholarship = cell(22).lower()
                if scholarship in ["yes","no","true","false"]:
                    row["scholarship"] = scholarship in ["yes","true"]
                for contact_type, ni, pi in [("GUARDIAN",10,11),("EMERGENCY",14,15),
                                             ("DOCTOR",16,17),("PICKUP",19,20)]:
                    x=(header[ni][0]+header[ni][2])/2
                    merged=[b for b in table.cells if b[0]<x<b[2] and b[1]<=y<b[3]
                            and abs(b[0]-header[ni][0])<.05 and abs(b[2]-header[pi][2])<.05]
                    if len(merged)==1:
                        raw=" ".join((page.crop(merged[0]).extract_text() or "").split())
                        if raw:row["contacts"].append({"type":contact_type,"name":None,"phone":None,"sourceText":raw})
                        continue
                    if cell(ni) or cell(pi):
                        row["contacts"].append({"type":contact_type,"name":cell(ni) or None,
                                                "phone":cell(pi) or None})
                for i in range(6):
                    row["days"].append({"dayNumber":i+1,"present":mark(DROP[i]),
                                        "pickedUp":mark(PICKUP[i]),
                                        "cardNumber":cell(33+i) or None if i<2 else None})
                if age_raw and not age_match:
                    row["requiresReview"] = True
                    row["reviewNote"] = "The source age could not be read unambiguously."
                rows.append(row)
    duplicates = collections.Counter(r["name"].casefold() for r in rows)
    for row in rows:
        if duplicates[row["name"].casefold()] > 1:
            row["requiresReview"] = True
            row["reviewNote"] = "Repeated child name in source; compare attendance before merging or skipping."
    return rows


def curriculum(path):
    with pdfplumber.open(path) as pdf:
        pages = [p.extract_text() or "" for p in pdf.pages]
    joined = "\n".join(pages)
    matches = list(re.finditer(r"(?im)^game\s+(\d+)\s*[: ]",joined))
    titles = ["Creation Relay Race","Lily Pad Relay","Five Seconds · Bible Edition",
              "Bible Emoji Challenge · Teen Edition","Two Truths and a Bible Lie",
              "Teamwork Towers","Scramble Words","Clap When the Ball Drops",
              "Steady or Not","My Eyes, Your Hands"]
    resources = []
    for i, match in enumerate(matches):
        end = matches[i+1].start() if i+1<len(matches) else len(joined)
        number = int(match[1])
        page_start = joined[:match.start()].count("\n")  # resolved via page offsets below
        offsets=[]; cursor=0
        for page in pages:
            offsets.append(cursor); cursor+=len(page)+1
        page_start=sum(offset<=match.start() for offset in offsets)
        page_end=sum(offset<end for offset in offsets)
        resources.append({"title":titles[number-1],"type":"GAME","content":joined[match.start():end].strip(),
                          "sourceName":path.name,"pageStart":page_start,"pageEnd":page_end})
    if len(resources)!=10:
        raise ValueError("Expected ten named games; source format changed, review required.")
    return resources


def volunteer_roster(path):
    """Preserve timetable rows and source identities without inventing accounts."""
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    activities, leads, current = [], [], None
    clean = lambda value: " ".join((value or "").split())
    def clock(value):
        hour, minute = map(int, value.split(":"))
        return f"{hour + (12 if hour < 8 else 0):02d}:{minute:02d}"
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            headings = page.search(r"(?m)^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\s*[—-]\s*\d+\s+AUGUST") or []
            events = [(h["top"], "heading", h) for h in headings]
            events += [(t.bbox[1], "table", t) for t in page.find_tables()]
            for _, kind, item in sorted(events, key=lambda e: e[0]):
                if kind == "heading":
                    current = days.index(item["groups"][0]) + 1
                    nearby = page.crop((0, item["bottom"], page.width, min(page.height, item["bottom"] + 100))).extract_text() or ""
                    lead = re.search(r"VBS Lead:\s*([^\n]+)", nearby)
                    if not lead:
                        raise ValueError("Missing roster day lead; review source layout.")
                    leads.append({"dayNumber":current,"name":clean(lead[1]),"sourcePage":page_number,"callTime":"08:00"})
                    continue
                for row_number, cells in enumerate(item.extract(), 1):
                    if len(cells) != 3:
                        continue
                    time = clean(cells[0])
                    match = re.fullmatch(r"(\d{1,2}:\d{2})[–—-](\d{1,2}:\d{2})", time)
                    if not match:
                        continue
                    if current is None:
                        raise ValueError("Timetable before a dated heading.")
                    raw_title, raw_people = clean(cells[1]), clean(cells[2])
                    title = raw_title.replace("R9egistration", "Registration")
                    group = next((g for g in ["Teenagers","Tribe A","Tribe B","Tribe C & D","Group 1","Group 2"] if g in title), None)
                    people = []
                    if raw_people not in ["—", "-", "Class teachers"]:
                        for person in re.split(r"[/+•]" if " — " not in raw_people else r"[•]", raw_people):
                            name, _, role = clean(person).partition(" — ")
                            people.append({"name":name,"role":role or title,"requiresReview":name == "Jennifer Anyaji"})
                    activities.append({"sourceKey":f"vbs2026-roster-p{page_number}-t{round(item.bbox[1])}-r{row_number}",
                        "dayNumber":current,"sourcePage":page_number,"title":title,"rawTitle":raw_title,
                        "startsAt":clock(match[1]),"endsAt":clock(match[2]),"group":group,
                        "rawPeople":raw_people,"people":people,"classTeachers":raw_people == "Class teachers"})
        notes = "\n".join(p.extract_text() or "" for p in pdf.pages[9:])
    if len(leads) != 6 or collections.Counter(a["dayNumber"] for a in activities) != {1:17,2:17,3:17,4:17,5:17,6:9}:
        raise ValueError("Unexpected roster row count; source needs review.")
    # Page 12 explicitly assigns craft to the same day's Bible teachers.
    for activity in activities:
        if activity["classTeachers"]:
            activity["people"] = [dict(p, role="Bible Response / Craft", group=lesson["group"])
                for lesson in activities if lesson["dayNumber"] == activity["dayNumber"] and lesson["title"].startswith("Bible Lesson")
                for p in lesson["people"]]
    return {"sourceName":path.name,"activities":activities,"leads":leads,"notes":notes,
        "classes":["Teenagers","Tribe A","Tribe B","Tribe C & D"],
        "rotations":{"Group 1":["Teenagers","Tribe A"],"Group 2":["Tribe B","Tribe C & D"]},
        "warning":"Saturday roster ends at 13:00; the separate proposed finale outline ends at 14:30. Neither proves actual delivery. Name variants are preserved separately until identity review."}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source-dir",type=Path,required=True)
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--roster",type=Path)
    args=parser.parse_args()
    files=["CREATIVE BANK.pdf","VBS Outline Plans (Word).pdf","VBS 2026 Abuja Attendance - Sheet1.pdf"]
    if not all((args.source_dir/n).is_file() for n in files):
        raise ValueError("Supply the three original PDFs.")
    args.output_dir.mkdir(mode=0o700,parents=True,exist_ok=True)
    rows=attendance(args.source_dir/files[2])
    resources=curriculum(args.source_dir/files[0])
    resources += [{"title":"VBS finale · programme outline","type":"LESSON_PLAN","sourceName":files[1],"pageStart":1,"pageEnd":7},
                  {"title":"The Great Jungle Journey · theme song","type":"SONG","url":"https://www.youtube.com/watch?v=DY0yI8ZPibQ"}]
    package={"name":"VBS 2026","themeName":"The Great Jungle Journey",
             "startDate":START.isoformat(),"endDate":(START+datetime.timedelta(days=5)).isoformat(),
             "timezone":"Africa/Lagos","kind":"CHILDREN","sourceName":files[2],"rows":rows,
             "days":[{"dayNumber":i+1,"date":(START+datetime.timedelta(days=i)).isoformat(),
                      "label":(START+datetime.timedelta(days=i)).strftime("%A")} for i in range(6)],
             "curriculum":resources,
             "reportedDropoffTotals":[62,64,61,65,65,63],
             "sources":[{"name":n,"sha256":hashlib.sha256((args.source_dir/n).read_bytes()).hexdigest()} for n in files]}
    if args.roster:
        package["volunteerRoster"] = volunteer_roster(args.roster)
        package["sources"].append({"name":args.roster.name,"sha256":hashlib.sha256(args.roster.read_bytes()).hexdigest()})
        package["curriculum"].append({"title":"VBS daily volunteer roster and operating notes","type":"DOCUMENT","sourceName":args.roster.name,"pageStart":1,"pageEnd":12})
    target=args.output_dir/"vbs-2026-review.json"
    with target.open("x",encoding="utf-8") as out:
        json.dump(package,out,ensure_ascii=False,indent=2)
    os.chmod(target,0o600)
    print(json.dumps({"rows":len(rows),"reviewRequired":sum(bool(r.get("requiresReview")) for r in rows),
                      "derivedDropoff":[sum(r["days"][i]["present"] is True for r in rows) for i in range(6)],
                      "reportedDropoff":package["reportedDropoffTotals"],
                      "resources":len(resources),"privatePackage":str(target)}))


if __name__=="__main__":
    main()
