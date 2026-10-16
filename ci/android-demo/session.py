import base64
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ['DEMO_ROOT']).resolve()
REPOSITORY = os.environ['GITHUB_REPOSITORY']
BRANCH = 'ci/android-recording-54-20261016'
DEADLINE = time.monotonic() + 2700


def api(path):
    result = subprocess.run(['gh', 'api', path], capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Repository control read failed')
    return json.loads(result.stdout)


def read_command():
    data = api(f'repos/{REPOSITORY}/contents/ci/android-demo/command.json?ref={BRANCH}')
    if int(data.get('size', 0)) > 256000:
        raise RuntimeError('Control document exceeds size bound')
    return json.loads(base64.b64decode(data['content']))


def local_path(name):
    path = (ROOT / name).resolve()
    if not path.is_relative_to(ROOT) or path == ROOT:
        raise RuntimeError('Path is outside the private test directory')
    return path


def send_private(path, command_id):
    if path.stat().st_size > 32 * 1024 * 1024:
        raise RuntimeError('Private result exceeds size bound')
    envelope = ROOT / f'{command_id}.sealed'
    result = subprocess.run(
        ['node', str(ROOT / 'private-evidence.mjs'), 'seal', str(path), str(ROOT / 'recipient.der'), str(envelope)],
        capture_output=True, timeout=30,
    )
    if result.returncode:
        raise RuntimeError('Private result encryption failed')
    result = subprocess.run(
        ['node', str(ROOT / 'private-evidence.mjs'), 'frames', str(envelope)],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode:
        raise RuntimeError('Private result framing failed')
    records = result.stdout.splitlines()
    for record in records:
        print(f'STAGE_SEALED {command_id} {record}', flush=True)
        if len(records) <= 33:
            print(f'::notice title=Stage sealed {command_id}::{record}', flush=True)


def run_command(command):
    command_id = command['id']
    if not command_id.isalnum() or len(command_id) > 40:
        raise RuntimeError('Invalid control identifier')
    script = base64.b64decode(command['script'], validate=True)
    if hashlib.sha256(script).hexdigest() != command['sha256']:
        raise RuntimeError('Control script digest mismatch')
    if len(script) > 180000:
        raise RuntimeError('Control script exceeds size bound')
    path = ROOT / f'{command_id}.py'
    path.write_bytes(script)
    timeout = min(600, int(command.get('timeout', 120)), int(DEADLINE - time.monotonic()))
    if timeout < 1:
        raise RuntimeError('Session deadline reached')
    with open(ROOT / f'{command_id}.stdout', 'wb') as output, open(ROOT / f'{command_id}.stderr', 'wb') as errors:
        process = subprocess.Popen([sys.executable, str(path)], cwd=ROOT, stdout=output, stderr=errors, start_new_session=True)
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            code = 124
    result = {'id': command_id, 'exitCode': code}
    for stream in ['stdout', 'stderr']:
        value = (ROOT / f'{command_id}.{stream}').read_text(errors='replace')[-40000:]
        token = os.environ.get('GH_TOKEN', '')
        result[stream] = value.replace(token, '[redacted]') if token else value
    response = ROOT / f'{command_id}.response.json'
    response.write_text(json.dumps(result))
    send_private(response, command_id)
    if command.get('returnFile'):
        send_private(local_path(command['returnFile']), command_id + 'file')
    print(json.dumps({'command': command_id, 'completed': True, 'exitCode': code}), flush=True)


def cleanup():
    data = ROOT / 'owned-processes.json'
    if not data.exists():
        return
    for process in json.loads(data.read_text()):
        pid = int(process['pid'])
        try:
            proc = Path('/proc') / str(pid)
            text = (proc / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
            if proc.stat().st_uid == os.getuid() and str(ROOT) in text and os.getpgid(pid) == pid:
                os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            continue
        except FileNotFoundError:
            continue


def main():
    seen = {'idle'}
    print(json.dumps({'sessionReady': True, 'boundedSeconds': 2700, 'appInstalled': False, 'recordingCreated': False}), flush=True)
    try:
        while time.monotonic() < DEADLINE:
            command = read_command()
            if command['id'] not in seen:
                seen.add(command['id'])
                if command.get('action') == 'finish':
                    print(json.dumps({'sessionFinished': True, 'exitCode': int(command.get('exitCode', 2))}), flush=True)
                    return int(command.get('exitCode', 2))
                if command.get('action') != 'run':
                    raise RuntimeError('Unknown control action')
                run_command(command)
            time.sleep(15)
        print(json.dumps({'blocker': 'Bounded test session deadline reached', 'recordingVerified': False}), flush=True)
        return 2
    except Exception as error:
        print(json.dumps({'blocker': 'Controlled test session stopped', 'errorType': type(error).__name__}), flush=True)
        return 2
    finally:
        cleanup()


if __name__ == '__main__':
    sys.exit(main())
