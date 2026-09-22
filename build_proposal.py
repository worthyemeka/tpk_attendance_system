from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.graphics.barcode import qr
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import os, textwrap

OUT = 'output/pdf/tribepetra-kids-wuse-checkin-pickup-proposal.pdf'
PETRA = '/var/folders/rr/6tdq_dlj5wldx5k_27qvy8bm0000gn/T/codex-file-preview-dJ5MPW/image.png'
TRIBE = '/var/folders/rr/6tdq_dlj5wldx5k_27qvy8bm0000gn/T/codex-file-preview-Tk785h/image.png'
W, H = landscape(A4)

# Warm editorial palette - close fallbacks are used when requested web fonts are unavailable.
INK = HexColor('#12110F')
CREAM = HexColor('#FBF7EE')
PAPER = HexColor('#FFFDF9')
ORANGE = HexColor('#F5A623')
GOLD = HexColor('#FFD15A')
PEACH = HexColor('#FBE6C0')
SAGE = HexColor('#E7EFE7')
MUTED = HexColor('#766F65')
LINE = HexColor('#E7DFD1')
RED = HexColor('#D85B47')

SERIF = 'Times-Bold'
BODY = 'Helvetica'
BOLD = 'Helvetica-Bold'

def rect(c, x, y, w, h, fill, stroke=None, r=0):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(.7)
    else:
        c.setStrokeColor(fill)
    if r:
        c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke else 0)
    else:
        c.rect(x, y, w, h, fill=1, stroke=1 if stroke else 0)

def text(c, s, x, y, size=10, font=BODY, color=INK, leading=None, maxw=None):
    c.setFillColor(color); c.setFont(font, size)
    if not maxw:
        c.drawString(x, y, s); return y-size
    avg = max(1, int(maxw/(size*.53)))
    lines=[]
    for p in s.split('\n'):
        lines += textwrap.wrap(p, width=avg, break_long_words=False) or ['']
    lead = leading or size*1.35
    for line in lines:
        c.drawString(x, y, line); y -= lead
    return y

def right(c, s, x, y, size=9, font=BODY, color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawRightString(x,y,s)

def center(c, s, x, y, size=10, font=BODY, color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawCentredString(x,y,s)

def pill(c, s, x, y, w=None, fill=PEACH, color=INK):
    if w is None: w=stringWidth(s,BOLD,7)+18
    rect(c,x,y,w,17,fill,r=8.5); center(c,s,x+w/2,y+5.2,7,BOLD,color); return w

def header(c, section, num):
    rect(c,0,0,W,H,CREAM)
    rect(c,0,H-18,W,18,INK)
    text(c,'TRIBEPETRA KIDS  /  PETRA WUSE CAMPUS',35,H-12,6.8,BOLD,white)
    right(c,section.upper(),W-35,H-12,6.8,BOLD,GOLD)
    right(c,f'{num:02d}',W-35,24,8,BOLD,MUTED)
    c.setStrokeColor(LINE); c.line(35,42,W-35,42)

def title(c, kicker, heading, sub=None):
    text(c,kicker.upper(),35,H-62,7,BOLD,ORANGE)
    y=H-94
    # Hand-break deliberate display headings
    for line in heading.split('\n'):
        text(c,line,35,y,28,SERIF,INK); y-=31
    if sub: text(c,sub,35,y-3,10,BODY,MUTED,maxw=550)

def footer(c, phrase='Sunday Check-In & Pickup System Proposal'):
    text(c,phrase,35,25,7,BODY,MUTED)

def card(c,x,y,w,h,heading,body=None,accent=ORANGE,tag=None):
    rect(c,x,y,w,h,PAPER,LINE,10)
    rect(c,x,y+h-5,w,5,accent,r=5)
    if tag: pill(c,tag,x+15,y+h-28,fill=PEACH)
    text(c,heading,x+15,y+h-(47 if tag else 25),11,BOLD,INK,maxw=w-30)
    if body: text(c,body,x+15,y+h-(67 if tag else 45),8.6,BODY,MUTED,leading=11.5,maxw=w-30)

def step(c,x,y,w,n,heading,body,fill=INK):
    rect(c,x,y,w,84,PAPER,LINE,9)
    rect(c,x+13,y+47,25,25,fill,r=12.5)
    center(c,str(n),x+25.5,y+55,9,BOLD,white)
    text(c,heading,x+48,y+58,9.5,BOLD,INK,maxw=w-60)
    text(c,body,x+16,y+27,7.7,BODY,MUTED,leading=9.7,maxw=w-32)

def arrow(c,x1,y1,x2,y2,color=ORANGE):
    c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(1.5); c.line(x1,y1,x2,y2)
    import math
    a=math.atan2(y2-y1,x2-x1)
    for d in (.45,-.45): c.line(x2,y2,x2-8*math.cos(a+d),y2-8*math.sin(a+d))

def icon_circle(c,x,y,letter,fill=ORANGE):
    rect(c,x,y,28,28,fill,r=14); center(c,letter,x+14,y+9,11,BOLD,INK)

def mini_phone(c,x,y,w=145,h=250,kind='home'):
    rect(c,x,y,w,h,INK,r=18)
    rect(c,x+6,y+6,w-12,h-12,PAPER,r=13)
    rect(c,x+w/2-18,y+h-12,36,3,HexColor('#5B564F'),r=2)
    if kind=='home':
        center(c,'TRIBEPETRA KIDS',x+w/2,y+h-36,7,BOLD,INK)
        center(c,'WUSE CAMPUS',x+w/2,y+h-47,5.5,BOLD,ORANGE)
        center(c,'Good morning!',x+w/2,y+h-81,13,SERIF,INK)
        center(c,"Let's get the kids checked in.",x+w/2,y+h-97,6.8,BODY,MUTED)
        text(c,'Parent/Guardian phone number',x+17,y+h-130,6.5,BOLD,INK)
        rect(c,x+16,y+h-160,w-32,23,white,LINE,4); text(c,'0803 123 4567',x+25,y+h-152,7.5,BODY,INK)
        rect(c,x+16,y+h-194,w-32,26,ORANGE,r=4); center(c,'CONTINUE  >',x+w/2,y+h-185,7,BOLD,INK)
        center(c,'Need help? Please speak to a volunteer.',x+w/2,y+31,5.8,BODY,MUTED)
    elif kind=='found':
        center(c,'TRIBEPETRA KIDS',x+w/2,y+h-35,7,BOLD,INK)
        center(c,'Welcome back, Grace!',x+w/2,y+h-65,11,SERIF,INK)
        center(c,'Who are you checking in today?',x+w/2,y+h-79,6.5,BODY,MUTED)
        for i,(n,cl) in enumerate([('David Adebayo','Tribe A | 9-12'),('Sarah Adebayo','Tribe B | 5-8')]):
            yy=y+h-116-i*43; rect(c,x+15,yy,w-30,34,white,LINE,5); text(c,'○',x+23,yy+12,10,BOLD,ORANGE); text(c,n,x+42,yy+20,7,BOLD,INK); text(c,cl,x+42,yy+9,5.6,BODY,MUTED)
        center(c,'+ ADD ANOTHER CHILD',x+w/2,y+75,6.4,BOLD,ORANGE)
        rect(c,x+16,y+33,w-32,26,ORANGE,r=4); center(c,'CHECK IN 2 CHILDREN',x+w/2,y+42,6.4,BOLD,INK)
    elif kind=='pass':
        center(c,'TRIBEPETRA KIDS',x+w/2,y+h-35,7,BOLD,INK)
        center(c,'✓',x+w/2,y+h-77,25,BOLD,HexColor('#2D7A47'))
        center(c,'David is checked in',x+w/2,y+h-100,11,SERIF,INK)
        rect(c,x+16,y+h-155,w-32,39,PEACH,r=5); text(c,'DAVID A.',x+25,y+h-132,8,BOLD,INK); text(c,'Tribe A  |  Checked in 9:14 AM',x+25,y+h-144,5.8,BODY,MUTED)
        center(c,'YOUR PICKUP PASS',x+w/2,y+h-183,6,BOLD,MUTED)
        center(c,'B27-M4',x+w/2,y+h-207,19,SERIF,INK)
        q=qr.QrCodeWidget('https://kids.petra.example/p/B27-M4'); q.barWidth=48; q.barHeight=48; q.drawOn(c,x+w/2-24,y+48)
        rect(c,x+16,y+19,w-32,23,ORANGE,r=4); center(c,'SAVE PICKUP PASS',x+w/2,y+27,6,BOLD,INK)

def flow_page(c, number, heading, sub, labels, note=None):
    header(c, heading, number); title(c,'End-to-end flow',heading,sub)
    x=40; y=245; width=(W-80-(len(labels)-1)*10)/len(labels)
    for i,(h,b) in enumerate(labels):
        step(c,x+i*(width+10),y,width,i+1,h,b,ORANGE if i<2 else (INK if i==len(labels)-1 else GOLD))
        if i<len(labels)-1: arrow(c,x+i*(width+10)+width,y+42,x+(i+1)*(width+10)-4,y+42)
    if note:
        rect(c,40,128,W-80,72,SAGE,None,10); text(c,'Operational outcome',58,174,8,BOLD,INK); text(c,note,58,153,10,BODY,INK,maxw=W-120)
    footer(c)

def main():
    os.makedirs(os.path.dirname(OUT),exist_ok=True)
    c=canvas.Canvas(OUT,pagesize=(W,H)); c.setTitle('TribePetra Kids Wuse Campus Sunday Check-In & Pickup System')

    # 01 Cover
    rect(c,0,0,W,H,INK)
    c.setFillColor(ORANGE); c.circle(W-55,H-35,160,fill=1,stroke=0)
    c.setFillColor(GOLD); c.circle(53,55,95,fill=1,stroke=0)
    # dark image assets intentionally sit on dark canvas
    c.drawImage(PETRA,37,H-102,width=70,height=70,mask='auto',preserveAspectRatio=True)
    c.drawImage(TRIBE,W-236,H-191,width=205,height=205,mask='auto',preserveAspectRatio=True)
    pill(c,'PROPOSAL  |  SEPTEMBER 2026',55,318,w=164,fill=ORANGE)
    text(c,'A better Sunday\nstarts at the door.',55,256,34,SERIF,white)
    text(c,'TribePetra Kids Wuse Campus\nSunday Check-In & Pickup System',55,187,16,BOLD,GOLD,leading=21)
    text(c,'A warm, secure and inclusive attendance-to-pickup experience for every family.',55,135,10,BODY,HexColor('#E9E3D8'),maxw=410)
    text(c,'Prepared for unit leadership',55,70,8,BOLD,HexColor('#E9E3D8'))
    c.showPage()

    # 02 Executive summary
    header(c,'Executive summary',2); title(c,'The recommendation','One permanent QR poster.\nOne shared system.\nOne safer Sunday journey.')
    card(c,35,214,238,142,'The decision','Use one branded A4/A3 QR poster at Petra Wuse to open the check-in web app. The QR begins the journey; it does not identify a child.',ORANGE,'THE DOORWAY')
    card(c,302,214,238,142,'The experience','Returning families check in in seconds. First-time families register and check in in one guided flow. Volunteers can assist on church tablets.',GOLD,'FOR EVERY FAMILY')
    card(c,569,214,238,142,'The assurance','Every attendance record creates a Sunday-specific pickup credential. Pickup requires the credential plus authorised-guardian verification.',INK,'FOR SAFEGUARDING')
    text(c,'What leadership gets',35,156,11,SERIF,INK)
    items=[('Faster arrival','Less queueing and fewer cards to issue, replace or lose.'),('Live visibility','Attendance-by-class and still-present counts update as children check in and leave.'),('Campus-ready foundation','Petra Wuse launches first; campus and class configuration make future adoption a controlled extension.')]
    for i,(h,b) in enumerate(items):
        x=35+i*258; icon_circle(c,x,99,str(i+1)); text(c,h,x+37,116,9,BOLD,INK); text(c,b,x+37,96,7.8,BODY,MUTED,maxw=204)
    footer(c); c.showPage()

    # 03 Challenge and decision rationale
    header(c,'Why change',3); title(c,'The Sunday problem is not a card problem.','It is an identification, attendance and safeguarding problem.')
    card(c,35,234,235,154,'Physical cards create friction','Cards must be produced, distributed, remembered, replaced and reconciled. New families arrive without one; forgotten cards create a second queue.',RED,'TODAY')
    card(c,304,234,235,154,'A child-specific QR/card is not the answer','It still creates issuance and replacement logistics, can be shared or lost, and is less useful for a new family walking in for the first time.',RED,'NOT RECOMMENDED')
    card(c,573,234,235,154,'Recommended: QR as the doorway','One permanent poster opens the same guided web experience for new and returning families. The system confirms who is attending before creating attendance.',ORANGE,'MVP MODEL')
    rect(c,35,123,W-70,70,INK,None,11)
    text(c,'Key distinction',55,168,8,BOLD,GOLD)
    text(c,'Scanning the poster never marks a child present. Attendance is created only after a guardian identifies and confirms the child or children who are attending today.',55,144,11,BODY,white,maxw=700)
    footer(c); c.showPage()

    # 04 Principles
    header(c,'Design principles',4); title(c,'Four principles set the standard.','They guide the interface, volunteer process and safeguards.')
    principles=[('FAST','Returning family: scan, phone, choose child, check in. Aim for 10-15 seconds.',ORANGE),('SECURE','A phone number finds a family at drop-off; it never authorises pickup.',INK),('INCLUSIVE','Self-service on a parent phone and assisted check-in on church tablets use the same system.',GOLD),('SIMPLE','No login, password, campus picker or separate visitor route. The poster already establishes Wuse.',HexColor('#D9B45C'))]
    for i,(h,b,col) in enumerate(principles):
        x=35+(i%2)*390; y=280-(i//2)*142; rect(c,x,y,355,112,PAPER,LINE,12); icon_circle(c,x+20,y+60,h[0],col); text(c,h,x+61,y+76,18,SERIF,INK); text(c,b,x+61,y+50,8.8,BODY,MUTED,maxw=258)
    rect(c,35,107,W-70,60,PEACH,None,10); center(c,'SCAN  ->  IDENTIFY  ->  CHECK IN  ->  VERIFY  ->  PICK UP',W/2,130,13,BOLD,INK)
    footer(c); c.showPage()

    # 05 Scope & classes
    header(c,'Campus scope',5); title(c,'Built for Petra Wuse first.','Designed so expansion does not require a rebuild.')
    card(c,35,250,330,130,'V1 campus scope','The entrance poster, volunteer tablets, dashboard, pickup desk and classroom views are configured for Petra Wuse Campus. No campus selection is shown to parents.',ORANGE,'LAUNCH')
    card(c,407,250,400,130,'Future-campus architecture','Every operational record is tied to a campus and service session. Each campus can have its own poster URL, class rules, volunteer access and reporting - while sharing one product foundation.',GOLD,'READY WHEN NEEDED')
    text(c,'Real Wuse classes',35,204,11,SERIF,INK)
    classes=[('TribePetra Teens','Teens','Configured locally'),('Tribe A','Ages 9-12','DOB-driven assignment'),('Tribe B','Ages 5-8','DOB-driven assignment'),('Tribe C','Ages 3-4','DOB-driven assignment')]
    for i,(n,a,b) in enumerate(classes):
        x=35+i*195; rect(c,x,107,175,72,PAPER,LINE,9); pill(c,a,x+13,151,fill=PEACH); text(c,n,x+13,134,9,BOLD,INK,maxw=148); text(c,b,x+13,117,6.6,BODY,MUTED)
    footer(c); c.showPage()

    # 06 Poster
    header(c,'Arrival experience',6); title(c,'One poster at the entrance.','A clear invitation, not a child credential.')
    # Poster mockup
    rect(c,67,90,270,385,INK,None,8); c.drawImage(TRIBE,99,347,width=205,height=105,mask='auto',preserveAspectRatio=True)
    center(c,'WELCOME TO CHURCH!',202,315,14,SERIF,white); center(c,'Checking in your child?',202,288,11,BOLD,GOLD)
    q=qr.QrCodeWidget('https://kids.petra.example/wuse/check-in'); q.barWidth=117; q.barHeight=117; q.drawOn(c,144,153)
    center(c,'Scan to check in',202,133,10,BOLD,white); center(c,'Fast  |  Safe  |  Simple',202,115,7,BODY,HexColor('#E9E3D8'))
    center(c,'No smartphone? A volunteer will be happy to help.',202,101,6.5,BODY,GOLD)
    text(c,'Suggested poster copy',388,405,11,SERIF,INK)
    text(c,'Welcome to church!\nChecking in your child?\n\nScan to check in\nFast | Safe | Simple\n\nNo smartphone? A volunteer will be happy to help.',388,370,12,BODY,INK,leading=19,maxw=330)
    rect(c,388,148,375,105,SAGE,None,10); text(c,'Why this works',408,221,8,BOLD,INK); text(c,'The poster URL identifies the campus and opens a responsive check-in page. It holds no family, child or medical information, and one durable print works for every Sunday.',408,196,9,BODY,INK,maxw=325)
    footer(c); c.showPage()

    # 07 returning flow UI
    header(c,'Returning child',7); title(c,'Returning family check-in','Familiar families should be checked in with almost no friction.')
    mini_phone(c,58,103,145,250,'home'); mini_phone(c,350,103,145,250,'found'); mini_phone(c,642,103,145,250,'pass')
    arrow(c,212,228,339,228); arrow(c,504,228,631,228)
    text(c,'1. Scan poster',58,76,8,BOLD,INK); text(c,'2. Enter guardian phone',350,76,8,BOLD,INK); text(c,'3. Save Sunday pickup pass',642,76,8,BOLD,INK)
    footer(c); c.showPage()

    # 08 returning flow detail
    flow_page(c,8,'Returning child - system flow','Attendance is created only after the guardian selects children and confirms check-in.',[
        ('Scan poster','The Wuse check-in web app opens.'),('Enter phone','The guardian number finds the family.'),('Select children','One or multiple registered children can be selected.'),('Check in','One attendance record is created per selected child.'),('Success + pass','Dashboard and class count update; Sunday pickup pass is shown.')],
        'If a child is already checked in, the system says so clearly, does not create a duplicate attendance record, and offers the existing pickup pass. A guardian can recover a lost pass by securely re-entering the same family route; the desk can assist when needed.')
    c.showPage()

    # 09 new flow
    flow_page(c,9,'New family / new child','A first visit is welcomed, not treated as an error state.',[
        ('Scan + phone','Same poster; number is not recognised.'),('Welcome','Friendly first-time state: “We would love to get your child checked in today.”'),('Guardian','Name, phone and relationship only. No unnecessary Sunday-morning form.'),('Child + class','Name and DOB; class is assigned from configured rules.'),('Review + check in','Create family, people, attendance and pickup credential in one action.')],
        'The confirmation action creates: family, guardian, child, class assignment, authorised pickup list, today\'s attendance and a Sunday-specific pickup credential. The classroom and dashboard show a discreet First Visit indicator.')
    c.showPage()

    # 10 registration details and edge cases
    header(c,'New family / new child',10); title(c,'Register only what enables care and safe pickup.','A three-step first-visit experience, plus safe exceptions.')
    card(c,35,245,230,155,'1. Guardian details','First name, last name, phone number and relationship to child. Email is optional; address and unrelated demographic fields are not required for Sunday check-in.',ORANGE,'MINIMUM DATA')
    card(c,306,245,230,155,'2. Child + care details','First name, last name and date of birth. Optional important care information: allergies, medical or accessibility needs. Access is limited to authorised care roles.',GOLD,'CHILD SAFETY')
    card(c,577,245,230,155,'3. Authorised pickup','The registering guardian is included; another authorised person can be added with name, relationship and phone. Review then Register & Check In.',INK,'PICKUP')
    rect(c,35,111,369,82,SAGE,None,10); text(c,'Existing family + new child',53,166,9,BOLD,INK); text(c,'Family found -> Add another child -> child details + DOB + optional care info -> inherit/review authorised pickup people -> check in. Guardian details are not re-entered.',53,142,8.5,BODY,INK,maxw=320)
    rect(c,438,111,369,82,PEACH,None,10); text(c,'Class assignment guardrail',456,166,9,BOLD,INK); text(c,'DOB maps to configured Wuse class rules. If the age is below Tribe C, beyond configured ranges, or otherwise cannot be assigned, the app routes the family to a volunteer - it never guesses.',456,142,8.5,BODY,INK,maxw=320)
    footer(c); c.showPage()

    # 11 assisted check-in
    header(c,'Inclusive operation',11); title(c,'No smartphone? Same welcome.','Church tablets give volunteers the exact same secure path.')
    rect(c,54,125,270,270,INK,r=18); rect(c,66,139,246,238,PAPER,r=9); center(c,'ASSISTED CHECK-IN',189,350,9,BOLD,INK); rect(c,86,281,205,33,white,LINE,5); text(c,'Guardian phone number',97,303,6,BOLD,MUTED); text(c,'0803 123 4567',97,289,9,BODY,INK); rect(c,86,235,205,29,ORANGE,r=5); center(c,'FIND FAMILY',189,245,7,BOLD,INK); text(c,'No smartphone? No problem.',86,201,10,SERIF,INK); text(c,'The volunteer uses the same web app. For a first-time family, they complete the same guided registration with the parent.',86,180,7.5,BODY,MUTED,maxw=190)
    text(c,'Volunteer service flow',385,365,12,SERIF,INK)
    for i,(h,b) in enumerate([('Ask','“What is your phone number?”'),('Find / register','Search family or complete the short first-visit form.'),('Confirm','Let guardian select children and review pickup people.'),('Issue fallback','Give a temporary Sunday pickup token if the family cannot save a digital pass.')]):
        yy=315-i*55; icon_circle(c,385,yy-7,str(i+1),ORANGE); text(c,h,424,yy+8,9,BOLD,INK); text(c,b,424,yy-8,8,BODY,MUTED,maxw=300)
    footer(c); c.showPage()

    # 12 pickup
    header(c,'Pickup and safeguarding',12); title(c,'A pass starts pickup. It does not replace verification.','Release is a deliberate, auditable action by an authorised volunteer.')
    labels=[('Present pass','Guardian shows a Sunday-specific code or opaque QR. Pass is valid for that service day only.'),('Find attendance','Volunteer scans/enters the credential and sees child, class and permitted pickup information.'),('Verify guardian','Volunteer confirms the collecting person against the authorised pickup record and church process.'),('Release child','Status becomes Picked Up; time and volunteer are recorded. Duplicate release is blocked.')]
    x=35
    for i,(h,b) in enumerate(labels):
        step(c,x+i*195,252,175,i+1,h,b,INK if i==3 else ORANGE)
        if i<3: arrow(c,x+i*195+177,294,x+(i+1)*195-4,294)
    rect(c,35,122,W-70,79,PEACH,None,10); text(c,'Important safeguarding decision',55,174,9,BOLD,INK); text(c,'A phone number is only a family lookup convenience at drop-off. It is never sufficient to collect a child. The pickup desk must see a valid daily credential and complete authorised-guardian verification. If a pass is unavailable, the volunteer follows a controlled recovery / escalation process.',55,148,9.2,BODY,INK,maxw=700)
    footer(c); c.showPage()

    # 13 privacy
    header(c,'Privacy and safeguarding',13); title(c,'Safety is designed into the data and the workflow.','A child-focused system should collect less, show less and record the critical actions.')
    safeguards=[('No PII in QR','Poster and pickup QR values are opaque tokens, not names, phones, DOBs or care details.'),('Minimum data','Collect only the information required for check-in, care and authorised pickup.'),('Role-limited care notes','Care information is hidden from general screens; authorised team members open it only when needed.'),('Auditable actions','Check-in, pass recovery, pickup request and child release record time, user and outcome.'),('Short-lived credentials','Pickup credential is Sunday/session-specific and invalid after the attendance is closed.'),('Controlled exceptions','No-match, pass recovery and age-routing paths are handled by trained volunteers, not workarounds.')]
    for i,(h,b) in enumerate(safeguards):
        x=35+(i%3)*258; y=300-(i//3)*121; rect(c,x,y,235,94,PAPER,LINE,10); icon_circle(c,x+15,y+50,str(i+1),ORANGE if i<3 else GOLD); text(c,h,x+53,y+64,8.8,BOLD,INK,maxw=160); text(c,b,x+15,y+28,7.4,BODY,MUTED,leading=9.5,maxw=202)
    footer(c); c.showPage()

    # 14 operations dashboard
    header(c,'Operational impact',14); title(c,'One Sunday picture for leaders, teachers and volunteers.','Live attendance improves care without turning the dashboard into a public data display.')
    # Dashboard mockup
    rect(c,35,92,485,345,PAPER,LINE,11); text(c,'Good morning!',55,407,16,SERIF,INK); text(c,"Here is what's happening at TribePetra Kids (Wuse Campus) today.",55,390,7.5,BODY,MUTED)
    metrics=[('186','Checked in'),('55','Still present'),('131','Picked up'),('4','Classes')]
    for i,(n,l) in enumerate(metrics):
        x=55+i*103; rect(c,x,322,90,48,CREAM,None,6); center(c,n,x+45,345,16,SERIF,INK); center(c,l,x+45,330,6,BOLD,MUTED)
    text(c,'Attendance by class',55,290,9,BOLD,INK)
    for i,(name,n) in enumerate([('TribePetra Teens','32'),('Tribe A (9-12)','47'),('Tribe B (5-8)','58'),('Tribe C (3-4)','49')]):
        yy=268-i*28; text(c,name,55,yy,7.7,BODY,INK); rect(c,162,yy-2,190,8,LINE,r=4); rect(c,162,yy-2,int(190*int(n)/60),8,ORANGE,r=4); right(c,n,379,yy,7.7,BOLD,INK)
    text(c,'Recent check-ins',55,135,9,BOLD,INK); text(c,'Adebayo Family  |  David A.  |  Tribe B  |  First Visit  |  9:14 AM',55,117,7,BODY,MUTED)
    card(c,555,285,252,112,'Dashboard impact','Live counts: checked in, picked up, still present and classes. Attendance by class becomes useful for room readiness and leadership visibility.',ORANGE,'LEADERSHIP')
    card(c,555,150,252,112,'Classroom impact','Teachers see their current roster, discreet First Visit indicator and a protected care-info alert. Detailed care information remains access-controlled.',GOLD,'CLASSROOM')
    footer(c); c.showPage()

    # 15 technical direction
    header(c,'Product foundation',15); title(c,'A practical MVP stack.','Responsive for parent phones, volunteer tablets and reception laptops.')
    card(c,35,260,232,120,'Experience layer','Next.js + TypeScript\nResponsive web app\nParent check-in, volunteer desk, dashboard and classroom views.',ORANGE,'FRONT END')
    card(c,305,260,232,120,'Application layer','Next.js server/API layer\nRole-based staff access\nAttendance, pickup and audit workflows.',GOLD,'WORKFLOW')
    card(c,575,260,232,120,'Data layer','MySQL + Prisma\nTransactional registration/check-in\nCampus-aware relational model.',INK,'DATA')
    text(c,'Core entities',35,210,11,SERIF,INK)
    entities=[('Campus','Wuse first; configurable future locations'),('Class','Age rules, room / team configuration'),('Family','Household record'),('Guardian','Contact and authorised pickup relationship'),('Child','DOB, class assignment, limited care notes'),('Service Session','Specific Sunday / service context'),('Attendance','Checked in -> pickup requested -> picked up'),('Pickup Credential','Opaque, Sunday-specific token'),('Volunteer / Audit Log','Role, action, time and outcome')]
    for i,(h,b) in enumerate(entities):
        x=35+(i%3)*258; y=174-(i//3)*38; text(c,h,x,y,7.3,BOLD,INK); text(c,b,x+83,y,7.1,BODY,MUTED,maxw=160)
    footer(c); c.showPage()

    # 16 MVP rollout
    header(c,'MVP rollout',16); title(c,'Pilot it deliberately, then scale what works.','The aim is a calm Sunday, not a complicated software launch.')
    phases=[('1. Prepare','Confirm Wuse class rules, service sessions, pickup verification policy, volunteer roles and escalation script.'),('2. Prototype','Build and test returning-family flow first, then new-family registration and pickup in a controlled walkthrough.'),('3. Pilot Sunday','Use one poster, two assisted tablets and a pickup desk. Have a visible volunteer support point and temporary fallback tokens.'),('4. Review + improve','Measure check-in time, queue length, exception types, duplicate attempts, recovery needs and teacher feedback before wider rollout.')]
    for i,(h,b) in enumerate(phases):
        x=35+i*195; rect(c,x,225,175,154,PAPER,LINE,10); rect(c,x+15,330,31,31,ORANGE if i<2 else GOLD,r=15.5); center(c,str(i+1),x+30.5,340,10,BOLD,INK); text(c,h,x+15,307,11,SERIF,INK); text(c,b,x+15,278,7.7,BODY,MUTED,leading=10,maxw=145)
        if i<3: arrow(c,x+177,302,x+190,302)
    rect(c,35,105,W-70,80,INK,None,11); text(c,'Leadership decision requested',55,158,9,BOLD,GOLD); text(c,'Approve a Petra Wuse MVP pilot based on the permanent QR poster + assisted check-in model, with Sunday-specific pickup credentials and authorised-guardian verification as the safeguarding baseline.',55,132,11,BODY,white,maxw=695)
    footer(c); c.showPage()

    c.save()

if __name__ == '__main__': main()
