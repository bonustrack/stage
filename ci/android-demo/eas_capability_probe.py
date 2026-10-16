import ctypes.util
import fcntl
import json
import os
import platform
import shutil
import stat
import sys
from pathlib import Path


def inspect_kvm(path=Path('/dev/kvm')):
    result = {
        'architecture': platform.machine(),
        'kvmExists': path.exists(),
        'permissionChangesPerformed': False,
        'androidBootVerified': False,
        'appDownloaded': False,
        'appInstalled': False,
        'cameraInputVerified': False,
        'microphoneInputVerified': False,
        'recordingCreated': False,
    }
    if not path.exists():
        result['blocker'] = 'Worker has no KVM device'
        return result, 2
    details = path.stat()
    result.update({
        'mode': stat.filemode(details.st_mode),
        'deviceUid': details.st_uid,
        'deviceGid': details.st_gid,
        'runnerUid': os.getuid(),
        'runnerGroups': os.getgroups(),
        'readable': os.access(path, os.R_OK),
        'writable': os.access(path, os.W_OK),
    })
    if not result['readable'] or not result['writable']:
        result['blocker'] = 'KVM is not accessible with existing worker permissions'
        return result, 2
    try:
        fd = os.open(path, os.O_RDWR | os.O_CLOEXEC)
        try:
            result['kvmApiVersion'] = fcntl.ioctl(fd, 0xAE00, 0)
        finally:
            os.close(fd)
    except OSError as error:
        result['blocker'] = 'KVM open or API check failed'
        result['errno'] = error.errno
        return result, 2
    if result['architecture'] != 'x86_64' or result['kvmApiVersion'] != 12:
        result['blocker'] = 'Unexpected worker architecture or KVM API'
        return result, 2
    result['accelerationAccessible'] = True
    return result, 0


def tool_inventory():
    names = ['python3', 'node', 'java', 'adb', 'emulator', 'Xvfb', 'xauth', 'pulseaudio', 'pactl', 'ffmpeg', 'timeout']
    paths = {name: shutil.which(name) for name in names}
    sdk = os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME')
    if sdk:
        for name, suffix in [('adb', 'platform-tools/adb'), ('emulator', 'emulator/emulator')]:
            candidate = Path(sdk) / suffix
            if not paths[name] and candidate.is_file() and os.access(candidate, os.X_OK):
                paths[name] = str(candidate)
    result = {'toolAvailable': {name: bool(path) for name, path in paths.items()}}
    if paths['emulator']:
        root = Path(paths['emulator']).resolve().parent
        result['fullEmulatorBackendFilePresent'] = (root / 'qemu/linux-x86_64/qemu-system-x86_64').is_file()
        result['headlessEmulatorBackendFilePresent'] = (root / 'qemu/linux-x86_64/qemu-system-x86_64-headless').is_file()
    result['libpulseDiscoverable'] = bool(ctypes.util.find_library('pulse'))
    result['inventoryOnlyNotMediaVerification'] = True
    return result


def main():
    result, code = inspect_kvm()
    if code == 0:
        result.update(tool_inventory())
        result['nextUnverifiedGate'] = 'Private display and actual Android microphone/camera capture'
    print(json.dumps(result, sort_keys=True), flush=True)
    return code


if __name__ == '__main__':
    sys.exit(main())
