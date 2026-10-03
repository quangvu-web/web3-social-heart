"""Run only against the disposable Unix-socket fixture database, never production."""
import concurrent.futures
import os
from pathlib import Path
import subprocess
import sys
import threading

psql, socket, port = sys.argv[1:]
if not Path(socket).resolve().as_posix().startswith('/private/tmp/fun-join-pg.'):
    raise SystemExit('A disposable fun-join-pg Unix socket is required')
base = [psql, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', socket,
        '-p', port, '-d', 'fun_join_recovery_test']
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
def sql(statement):
    return subprocess.check_output(base + ['-c', statement], env=env, text=True).strip()
assert sql("SELECT current_database()='fun_join_recovery_test' AND inet_server_addr() IS NULL") == 't'
when = sql('SELECT clock_timestamp()')
barrier = threading.Barrier(2)
def record(_):
    barrier.wait()
    return sql("SET ROLE service_role; SELECT id, inserted FROM public.tg_record_join_event"
               f"(-200,99,'join','{when}','{{}}');").splitlines()[-1]
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    records = list(pool.map(record, range(2)))
assert len({r.split('|')[0] for r in records}) == 1, records
assert sorted(r.split('|')[1] for r in records) == ['f', 't'], records
event = records[0].split('|')[0]
barrier = threading.Barrier(2)
def claim(_):
    barrier.wait()
    return sql("BEGIN; SET LOCAL ROLE service_role; "
               f"SELECT coalesce(public.tg_claim_join_event('{event}')::text,'NO_CLAIM'); "
               "SELECT pg_sleep(0.5); COMMIT;").splitlines()[2]
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    claims = list(pool.map(claim, range(2)))
assert claims.count('NO_CLAIM') == 1, claims
token = next(c for c in claims if c != 'NO_CLAIM')
barrier = threading.Barrier(2)
def begin(_):
    barrier.wait()
    return sql("SET ROLE service_role; "
               f"SELECT public.tg_begin_join_delivery('{event}','{token}');").splitlines()[-1]
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results = list(pool.map(begin, range(2)))
assert sorted(results) == ['f', 't'], results
assert sql("SET ROLE service_role; "
           f"SELECT public.tg_finish_join_event('{event}','{token}','done','welcome_sent','sent');").splitlines()[-1] == 't'
print('PASS: concurrent record, claim and delivery; exactly one winner each')
