# Windows board recovery and diagnostics

This update addresses the observed restart blockage: an older board process kept `board.log` locked, and a later launch could not write to that file. An isolated Windows PowerShell test also reproduced a second failure: native stderr warnings could terminate the launcher and leave its child process running. The exact cause of the original November 2026 outage is not established.

## What changed

- Each board run has separate log files. A locked log from an old run no longer blocks a new run, and the manual start helper uses separate launcher logs.
- Native warning output is logged without automatically terminating the launcher. Genuine non-zero worker exits remain failures; even an unexpected zero exit is reported as a failure so the existing scheduled-task restart policy can act.
- A separate Windows task, `Jaami Masjid Display Watchdog`, checks the board's local state endpoint every 30 seconds. After three consecutive failed checks and a two-minute startup grace period, it attempts a safe recovery. It waits at least two minutes between checks that could trigger a recovery and requests no more than three watchdog restarts per hour while that watchdog process remains running. The board task's own Windows retry policy is separate.
- Before terminating a process, the watchdog verifies the board task definition, the runner's executable, exact command line, PID and creation time, and the ownership chain of any port 3000 listener. Unknown listeners, unverified runners and unexpected task definitions are left untouched. It rechecks the task and board to avoid interrupting a newly started or recovered instance.
- Stopping the board for maintenance stops the watchdog first. Backup and upgrade paths restore previously running tasks after a pre-copy failure; an update that fails after files are replaced remains stopped for recovery. Uninstall removes the watchdog task as well.
- Before an upgrade stops the board, it checks for unexpected board processes and refuses to proceed if the process tree cannot be verified. It stops the verified runner and its descendants before stopping the scheduled task, then waits for those processes to exit. A database locked by another process can still stop the backup; preserve the installation and investigate the lock.
- The board service uses LocalService. The watchdog uses SYSTEM only to control that service and its verified process tree; installation protects executable files from standard-user modification. Do not weaken these permissions or run the watchdog from a user-writable folder.

## What this does not guarantee

No watchdog can guarantee uninterrupted operation. The watchdog cannot recover a powered-off, sleeping or failed PC, network/display failure, a port held by an unknown process, a missing or altered task, or an unverified runner. It does not send a remote notification when recovery fails. Logs are stored locally, so check available disk space and maintain independent monitoring if outages must be noticed promptly.

A forced recovery can interrupt an update that is in progress, so maintain and test independent backups. Use the supplied stop script for maintenance: stopping only the board task in Task Scheduler can cause the watchdog to start it again.

Tests use isolated data, fake task operations, real disposable process trees and an isolated Wrangler runtime. Actual SYSTEM/LocalService scheduled-task registration, ACL migration, reboot and recovery on the masjid PC have not been verified by those tests. Perform and record those checks during a planned maintenance window after installation.

## Updating an existing Windows server

1. Extract the update outside the existing `C:\JaamiMasjidBoard` folder. Run `UPGRADE-WINDOWS.cmd` as Administrator and keep the verified rollback backup. Do not delete or replace the existing `.env`, `.board-data`, uploads or backups.
2. This update applies the protected installation ACL and changes the board task to LocalService. The automatic-service installer requires `%SystemDrive%\JaamiMasjidBoard` and rejects linked installation paths. If the existing installation differs, stop and review the migration; do not create a blank replacement.
3. Confirm both tasks are running, the local endpoint responds, existing notices and uploads are present, and each TV can load its own display. Check again after an agreed reboot.
4. During a separately agreed maintenance window, test recovery and confirm the task returns to Running and the display works. Do not deliberately interrupt a live critical display without arranging downtime and a recovery plan.

In administrator PowerShell on the actual server:

```powershell
Get-ScheduledTask -TaskName 'Jaami Masjid Display Service', 'Jaami Masjid Display Watchdog' |
    Select-Object TaskName, State

(Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/state' -TimeoutSec 20).StatusCode
```

A local HTTP 200 confirms the application is answering on the host. It does not by itself prove that remote TVs or the Mayyit sender can connect. Verify those separately.

## Logs and planned maintenance

Run the existing diagnostic script as Administrator:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\JaamiMasjidBoard\scripts\windows\Diagnose-Board.ps1"
```

New runs use `board-*.log` and `board-error-*.log`; `watchdog.log` records recovery decisions. Old `board.log` and `board-error.log` are retained. Normal access-request logging is reduced, but logs and database files still consume disk space. Backups contain credentials and board data and must remain private. Do not share `.env` or secrets when sending diagnostic output.

The supplied stop, backup, upgrade and uninstall scripts stop the watchdog before taking the board down. To resume after an intentional stop, start both tasks as Administrator:

```powershell
Start-ScheduledTask -TaskName 'Jaami Masjid Display Service'
Start-ScheduledTask -TaskName 'Jaami Masjid Display Watchdog'
```

If the upgrade fails, keep the backup printed by the updater and follow `UPDATE-EXISTING-WINDOWS-SERVER.txt`; do not delete the installation. If the watchdog logs an unverified process, unexpected task or unknown port owner, inspect it before intervening. Do not kill unrelated Node or PowerShell processes.

The first 8 November recovery preview was marked **do not install** after the masjid server's backup failed on a database held by a board worker. Only an archive reported as verified is a usable rollback backup; a partial archive is not verified. Use the corrected release and perform the upgrade during a maintenance window.
