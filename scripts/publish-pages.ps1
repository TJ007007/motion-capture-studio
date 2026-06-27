# Publish Motion Capture Studio to GitHub Pages (.github.io)
#
# Prerequisites: GitHub CLI installed and authenticated (gh auth login)
#
# Usage:
#   .\scripts\publish-pages.ps1
#   .\scripts\publish-pages.ps1 -GitHubUser YOUR_USERNAME
#
# Creates a public repo and deploys via GitHub Actions.
# Live URL (project site): https://YOUR_USERNAME.github.io/motion-capture-studio/
# Live URL (user site repo): https://YOUR_USERNAME.github.io/

param(
    [string]$GitHubUser = "TJ007007",
    [ValidateSet("project", "user")]
    [string]$SiteType = "project"
)

$ErrorActionPreference = "Stop"

function Get-GhExe {
    $cmd = Get-Command gh -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $default = "${env:ProgramFiles}\GitHub CLI\gh.exe"
    if (Test-Path $default) { return $default }
    throw "GitHub CLI (gh) not found. Install from https://cli.github.com/ or restart your terminal after installing."
}

$Gh = Get-GhExe
$RepoName = if ($SiteType -eq "user") { "$GitHubUser.github.io" } else { "motion-capture-studio" }
$LiveUrl = if ($SiteType -eq "user") { "https://$GitHubUser.github.io/" } else { "https://$GitHubUser.github.io/$RepoName/" }

Write-Host "GitHub user: $GitHubUser"
Write-Host "Repository:  $GitHubUser/$RepoName"
Write-Host "Live URL:    $LiveUrl"
Write-Host ""

& $Gh auth status | Out-Null

$remotes = @(git remote 2>$null)
if ($remotes -contains 'origin') {
    Write-Host "Remote 'origin' already exists."
} else {
    & $Gh repo create $RepoName --public --source=. --remote=origin -d "Motion Capture Studio GitHub Pages app"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create GitHub repository $GitHubUser/$RepoName" }
    Write-Host "Created repository $GitHubUser/$RepoName"
}

git push -u origin main

& $Gh api "repos/$GitHubUser/$RepoName/pages" -X POST -f "build_type=workflow" -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pages may already be enabled — check Settings > Pages > GitHub Actions."
}

Write-Host ""
Write-Host "Pushed to GitHub. Pages deploys automatically on push to main."
Write-Host "Open in ~1-2 minutes: $LiveUrl"
