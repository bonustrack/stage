import base64
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from eas_capability_probe import inspect_kvm, tool_inventory

ROOT = Path('/tmp/stage-recording-54')
CONTROL = 'https://api.github.com/repos/bonustrack/stage/contents/ci/android-demo/command.json?ref=ci/android-recording-54-20261016'
PHASE = sys.argv[1]
ACTIVE = None


def terminate(signum, frame):
    if ACTIVE and ACTIVE.poll() is None:
        os.killpg(ACTIVE.pid, signal.SIGTERM)
    cleanup()
    raise SystemExit(2)


signal.signal(signal.SIGTERM, terminate)
signal.signal(signal.SIGINT, terminate)


def private_result(path, identifier):
    if path.stat().st_size > 32 * 1024 * 1024:
        raise RuntimeError('Private result exceeds transport bound')
    envelope = ROOT / (identifier + '.sealed')
    helper = Path(__file__).with_name('private-evidence.mjs')
    subprocess.run(['node', str(helper), 'seal', str(path), str(ROOT / 'recipient.der'), str(envelope)], check=True, capture_output=True, timeout=30)
    encoded = subprocess.run(['node', str(helper), 'frames', str(envelope)], check=True, capture_output=True, text=True, timeout=30)
    for line in encoded.stdout.splitlines():
        print('STAGE_SEALED ' + identifier + ' ' + line, flush=True)


def initialize():
    if PHASE != 'capabilities':
        return
    os.umask(0o077)
    ROOT.mkdir(mode=0o700)
    (ROOT / 'recipient.der').write_bytes(base64.b64decode(os.environ['DEMO_RECIPIENT'], validate=True))
    remaining = min(2550, int(os.environ['DEMO_DEADLINE']) - time.time())
    if remaining < 20:
        raise RuntimeError('Absolute approved-attempt deadline already reached')
    (ROOT / 'deadline.json').write_text(json.dumps({'deadline': time.monotonic() + remaining, 'uid': os.getuid()}))
    result, code = inspect_kvm()
    result['probeExitCode'] = code
    result.update(tool_inventory())
    result['phase'] = PHASE
    result['transportCheck'] = base64.b64encode(os.urandom(24)).decode()
    path = ROOT / 'initial.json'
    path.write_text(json.dumps(result))
    private_result(path, 'initial')
    if code:
        raise RuntimeError('Existing worker acceleration capability unavailable')


def read_command():
    request = urllib.request.Request(CONTROL, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'stage-isolated-android-test'})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if int(data.get('size', 0)) > 256000:
        raise RuntimeError('Control document exceeds bound')
    return json.loads(base64.b64decode(data['content']))


def private_path(name):
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or path == ROOT:
        raise RuntimeError('Private path escaped session root')
    return path


def execute(command, remaining):
    global ACTIVE
    identifier = command['id']
    if not identifier.isalnum() or len(identifier) > 40:
        raise RuntimeError('Invalid command identifier')
    script = base64.b64decode(command['script'], validate=True)
    if len(script) > 180000 or hashlib.sha256(script).hexdigest() != command['sha256']:
        raise RuntimeError('Invalid command bytes or digest')
    path = ROOT / (identifier + '.py')
    path.write_bytes(script)
    environment = {key: value for key, value in os.environ.items() if key in ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'BROWSER', 'NODE_OPTIONS', 'DEMO_AAB', 'DEMO_ROOT']}
    environment['PYTHONDONTWRITEBYTECODE'] = '1'
    with (ROOT / (identifier + '.out')).open('wb') as out, (ROOT / (identifier + '.err')).open('wb') as err:
        process = subprocess.Popen([sys.executable, str(path)], cwd=ROOT, env=environment, stdout=out, stderr=err, start_new_session=True)
        ACTIVE = process
        try:
            code = process.wait(timeout=max(1, min(600, int(command.get('timeout', 120)), remaining)))
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            code = 124
    ACTIVE = None
    result = {'id': identifier, 'exitCode': code}
    for stream, suffix in [('stdout', '.out'), ('stderr', '.err')]:
        result[stream] = (ROOT / (identifier + suffix)).read_text(errors='replace')[-40000:]
    output = ROOT / (identifier + '.response.json')
    output.write_text(json.dumps(result))
    private_result(output, identifier)
    if command.get('returnFile'):
        private_result(private_path(command['returnFile']), identifier + 'file')
    return code


def cleanup():
    path = ROOT / 'owned-processes.json'
    if not path.exists():
        return
    for item in json.loads(path.read_text()):
        pid = int(item['pid'])
        try:
            proc = Path('/proc') / str(pid)
            text = (proc / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
            if proc.stat().st_uid == os.getuid() and str(ROOT) in text and os.getpgid(pid) == pid:
                os.killpg(pid, signal.SIGTERM)
        except (ProcessLookupError, FileNotFoundError):
            continue


def main():
    os.umask(0o077)
    initialize()
    deadline = json.loads((ROOT / 'deadline.json').read_text())
    if deadline['uid'] != os.getuid():
        raise RuntimeError('Session ownership mismatch')
    if PHASE == 'recording':
        artifact = Path(os.environ['DEMO_AAB'])
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        if artifact.stat().st_size != 166763669 or digest != '440f557c787c8ca410561edcd5580c46e3b36825099cd577378b30c8739b091a':
            raise RuntimeError('Existing candidate54 integrity mismatch')
        (ROOT / 'candidate-path.json').write_text(json.dumps({'path': str(artifact), 'sha256': digest}))
    seen_path = ROOT / 'seen.json'
    seen = set(json.loads(seen_path.read_text())) if seen_path.exists() else {'idle'}
    print(json.dumps({'sessionReady': True, 'phase': PHASE, 'maximumSessionSeconds': 2550, 'appInstalled': False, 'recordingCreated': False}), flush=True)
    advance = False
    try:
        while time.monotonic() < deadline['deadline']:
            command = read_command()
            if command['id'] not in seen:
                seen.add(command['id'])
                seen_path.write_text(json.dumps(sorted(seen)))
                if command.get('action') == 'advance' and PHASE == 'capabilities':
                    advance = True
                    return 0
                if command.get('action') == 'finish':
                    return int(command.get('exitCode', 2))
                if command.get('action') != 'run' or command.get('phase') != PHASE:
                    raise RuntimeError('Control action or phase mismatch')
                code = execute(command, int(deadline['deadline'] - time.monotonic()))
                if code and command.get('stopOnFailure', True):
                    return code
            time.sleep(max(0, min(60, deadline['deadline'] - time.monotonic())))
        print(json.dumps({'blocker': 'Single-attempt session deadline reached', 'recordingVerified': False}), flush=True)
        return 2
    finally:
        if not advance:
            cleanup()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'blocker': 'Private EAS test session stopped', 'errorType': type(error).__name__, 'recordingVerified': False}), flush=True)
        cleanup()
        sys.exit(2)
