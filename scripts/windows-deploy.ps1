# Node Social Auto-Deploy Script for Windows Server
# Adaptive polling: 10 min when idle, 60 sec when active
# Goes back to idle after 60 min of no changes

# CONFIGURATION
$repoPath = "C:\Projects\node-social"
$logFile = "C:\Projects\deploy-log.txt"
$stateFile = "C:\Projects\deploy-state.json"
$branch = "main"

# Timing (in seconds)
$idleInterval = 600      # 10 minutes when idle
$activeInterval = 60     # 60 seconds when active
$activeTimeout = 3600    # Go back to idle after 60 min of no changes

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Out-File -Append $logFile
    Write-Host "$timestamp - $msg"
}

function Get-State {
    if (Test-Path $stateFile) {
        return Get-Content $stateFile | ConvertFrom-Json
    }
    return @{
        mode = "idle"
        lastCheck = 0
        lastChange = 0
    }
}

function Save-State($state) {
    $state | ConvertTo-Json | Out-File $stateFile
}

# Load state
$state = Get-State
$now = [int](Get-Date -UFormat %s)

# Determine current interval based on mode
if ($state.mode -eq "active") {
    # Check if we should go back to idle (60 min no changes)
    $timeSinceChange = $now - $state.lastChange
    if ($timeSinceChange -gt $activeTimeout) {
        Log "No changes for 60 min, switching to idle mode (10 min checks)"
        $state.mode = "idle"
        Save-State $state
    }
    $currentInterval = $activeInterval
} else {
    $currentInterval = $idleInterval
}

# Check if enough time has passed since last check
$timeSinceCheck = $now - $state.lastCheck
if ($timeSinceCheck -lt $currentInterval) {
    # Not time to check yet, exit silently
    exit 0
}

# Update last check time
$state.lastCheck = $now
Save-State $state

# Ensure we're in the repo
if (-not (Test-Path $repoPath)) {
    Log "ERROR: Repository not found at $repoPath"
    exit 1
}

Set-Location $repoPath

# Fetch latest from remote
try {
    git fetch origin $branch 2>&1 | Out-Null
} catch {
    Log "ERROR: Failed to fetch from origin"
    exit 1
}

# Compare local and remote HEADs
$local = git rev-parse HEAD
$remote = git rev-parse "origin/$branch"

if ($local -ne $remote) {
    Log "========================================="
    Log "New commits detected! Deploying..."
    Log "Local:  $local"
    Log "Remote: $remote"

    # Switch to active mode
    if ($state.mode -ne "active") {
        Log "Switching to active mode (60 sec checks)"
    }
    $state.mode = "active"
    $state.lastChange = $now
    Save-State $state

    # Pull changes
    Log "Pulling changes..."
    $pullResult = git pull origin $branch 2>&1
    Log $pullResult

    # Install dependencies
    Set-Location "$repoPath\backend\api"
    Log "Installing dependencies..."
    npm install 2>&1 | Out-Null

    # Run database migrations
    Log "Running migrations..."
    $migrateResult = npx prisma migrate deploy 2>&1
    Log $migrateResult

    # Restart the API server
    Log "Restarting API server..."
    pm2 restart nodesocial-api 2>&1 | Out-Null

    # Confirm success
    $newHead = git rev-parse --short HEAD
    Log "Deploy complete! Now at: $newHead"
    Log "========================================="
} else {
    # Log mode status occasionally (every 10 checks in idle mode)
    if ($state.mode -eq "idle") {
        # Silent in idle mode
    }
}
