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


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source-dir",type=Path,required=True)
    parser.add_argument("--output-dir",type=Path,required=True)
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
