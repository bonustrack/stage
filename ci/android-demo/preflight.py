import fcntl
import json
import os
import platform
import stat
import sys
from pathlib import Path


def inspect_kvm(path=Path('/dev/kvm')):
    result = {
        'architecture': platform.machine(),
        'kvmExists': path.exists(),
        'permissionChangesPerformed': False,
        'androidBootVerified': False,
        'recordingCreated': False,
    }
    if not path.exists():
        result['blocker'] = 'Runner has no KVM device'
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
        result['blocker'] = 'KVM is not accessible with existing runner permissions'
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
        result['blocker'] = 'Unexpected runner architecture or KVM API'
        return result, 2
    result['accelerationAccessible'] = True
    return result, 0


if __name__ == '__main__':
    result, code = inspect_kvm()
    print(json.dumps(result, sort_keys=True), flush=True)
    sys.exit(code)
