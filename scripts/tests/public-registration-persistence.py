import json, urllib.request, urllib.error, subprocess, copy
DB='tpk_registration_test_20261124'
def sql(q):
 return subprocess.check_output(['mysql','-N',DB,'-e',q],text=True).strip()
def request(path,body):
 req=urllib.request.Request('http://127.0.0.1:8089/api/v1/public/'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def payload(n,registrationOnly=True):
 return dict(submissionKey=f'{n:032x}',registrationOnly=registrationOnly,guardian=dict(firstName='Test',lastName='Fixture',primaryPhone=f'080000000{n:02}',relationship='Mother',address='Test only'),children=[dict(firstName='Fictional',lastName='Fixture',dateOfBirth='2020-01-01',gender='FEMALE',careInformation='Test care note')],pickup={'mode':'SELF'},serviceSessionId=24,serviceStay='FIRST_SERVICE')
a=payload(1); status,r=request('registrations',a)
assert status==202,(status,r)
assert r['data']['status']=='REGISTERED' and not r['data']['requestToken'],r
assert sql('SELECT COUNT(*) FROM children')=='1'
assert sql('SELECT COUNT(*) FROM check_in_requests')=='0'
assert sql('SELECT COUNT(*) FROM child_guardians')=='1'
assert sql('SELECT COUNT(*) FROM child_care_profiles')=='1'
# Simulate a client losing the first response: exactly the same retry returns the receipt.
assert request('registrations',a)==(status,r)
assert sql('SELECT COUNT(*) FROM children')=='1'
changed=copy.deepcopy(a);changed['children'][0]['firstName']='Changed'
assert request('registrations',changed)[0]==409
b=payload(2,False);status,pending=request('registrations',b)
assert status==202,(status,pending)
assert pending['data']['status']=='PENDING' and len(pending['data']['requestToken'])==64
assert sql('SELECT COUNT(*) FROM children')=='2'
assert sql('SELECT COUNT(*) FROM attendance')=='0'
assert sql('SELECT COUNT(*) FROM check_in_requests')=='1'
assert request('registrations',b)==(status,pending)
c=payload(3,False);c['pickup']={'mode':'OTHER','fullName':'No phone','relationship':'Aunt'}
assert request('registrations',c)[0]==422
assert sql('SELECT COUNT(*) FROM families')=='2'
assert sql('SELECT COUNT(*) FROM children')=='2'
assert sql('SELECT COUNT(*) FROM public_registration_submissions')=='2'
check=dict(phone=b['guardian']['primaryPhone'],childIds=[pending['data']['children'][0]['id']],serviceSessionId=24,pickup='OTHER',picker={'fullName':'Fictional Picker','relationship':'Aunt','phone':'08000000009'})
status,r=request('check-ins',check);assert status==202,(status,r)
assert sql('SELECT COUNT(*) FROM check_in_requests')=='1'
stored=json.loads(sql('SELECT pickup_details_json FROM check_in_requests LIMIT 1'))
assert stored['pickup']['fullName']=='Fictional Picker' and stored['pickup']['phone']=='08000000009',stored
check['childIds']=[999999];assert request('check-ins',check)[0]==403
print('PASS: persisted child, family, guardian, care; registration-only; approval pending; lost-response retry; changed-payload conflict; validation rollback; legacy alternate pickup; request dedupe; child ownership; no attendance without approval.')
