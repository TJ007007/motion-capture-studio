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
$RepoName = if ($SiteType -eq "user") { "$GitHubUser.github.io" } else { "motion-capture-studio" }
$LiveUrl = if ($SiteType -eq "user") { "https://$GitHubUser.github.io/" } else { "https://$GitHubUser.github.io/$RepoName/" }

Write-Host "GitHub user: $GitHubUser"
Write-Host "Repository:  $GitHubUser/$RepoName"
Write-Host "Live URL:    $LiveUrl"
Write-Host ""

gh auth status | Out-Null

if (git remote get-url origin 2>$null) {
    Write-Host "Remote 'origin' already exists."
} else {
    gh repo create $RepoName --public --source=. --remote=origin --description "Professional IMU motion capture and analysis — GitHub Pages app"
    Write-Host "Created repository $GitHubUser/$RepoName"
}

git push -u origin main

gh api "repos/$GitHubUser/$RepoName/pages" -X POST -f "build_type=workflow" -f "source[branch]=main" -f "source[path]=/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pages may already be enabled — check Settings > Pages > GitHub Actions."
}

Write-Host ""
Write-Host "Pushed to GitHub. Pages deploys automatically on push to main."
Write-Host "Open in ~1-2 minutes: $LiveUrl"
