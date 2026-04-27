$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$agentOsDir = Join-Path $root '.agent-os'
$sharedRules = Join-Path $agentOsDir 'rules\AGENTS.shared.md'
$claudeTemplate = Join-Path $agentOsDir 'templates\CLAUDE.md'
$skillsSource = Join-Path $agentOsDir 'skills'

$generatedAgents = Join-Path $root 'AGENTS.md'
$generatedClaude = Join-Path $root 'CLAUDE.md'

$claudeSkills = Join-Path $root '.claude\skills'
$codexSkills = Join-Path $root '.codex\skills'

function Assert-PathExists {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path,
    [Parameter(Mandatory = $true)]
    [string] $Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw ('缺少{0}：{1}' -f $Label, $Path)
  }
}

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Mirror-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Source,
    [Parameter(Mandatory = $true)]
    [string] $Destination
  )

  Ensure-Directory -Path $Destination

  $entries = Get-ChildItem -LiteralPath $Source -Force
  foreach ($entry in $entries) {
    Copy-Item -LiteralPath $entry.FullName -Destination $Destination -Recurse -Force
  }
}

function Assert-MirroredSkills {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Destination,
    [Parameter(Mandatory = $true)]
    [string] $Label
  )

  $sourceRoot = (Resolve-Path -LiteralPath $skillsSource).Path.TrimEnd('\', '/')
  $skillFiles = Get-ChildItem -LiteralPath $skillsSource -Recurse -Filter 'SKILL.md' -File

  foreach ($skillFile in $skillFiles) {
    $relativeSkillPath = $skillFile.FullName.Substring($sourceRoot.Length).TrimStart('\', '/')
    Assert-PathExists -Path (Join-Path $Destination $relativeSkillPath) -Label ('{0} {1}' -f $Label, $relativeSkillPath)
  }
}

function Assert-GeneratedWorkflow {
  Assert-PathExists -Path $generatedAgents -Label '生成后的 AGENTS.md'
  Assert-PathExists -Path $generatedClaude -Label '生成后的 CLAUDE.md'
  Assert-PathExists -Path $claudeSkills -Label '生成后的 Claude skills 目录'
  Assert-PathExists -Path $codexSkills -Label '生成后的 Codex skills 目录'
  Assert-MirroredSkills -Destination $claudeSkills -Label 'Claude skill'
  Assert-MirroredSkills -Destination $codexSkills -Label 'Codex skill'
}

Assert-PathExists -Path $sharedRules -Label '共享规则文件'
Assert-PathExists -Path $claudeTemplate -Label 'Claude 模板'
Assert-PathExists -Path $skillsSource -Label '项目 skills 目录'

Set-Content -LiteralPath $generatedAgents -Value (Get-Content -LiteralPath $sharedRules -Raw -Encoding UTF8) -Encoding UTF8
Set-Content -LiteralPath $generatedClaude -Value (Get-Content -LiteralPath $claudeTemplate -Raw -Encoding UTF8) -Encoding UTF8

Ensure-Directory -Path (Join-Path $root '.claude')
Ensure-Directory -Path (Join-Path $root '.codex')

Mirror-Directory -Source $skillsSource -Destination $claudeSkills
Mirror-Directory -Source $skillsSource -Destination $codexSkills

Assert-GeneratedWorkflow

Write-Host "Agent OS sync complete"
Write-Host "  AGENTS.md ->" $sharedRules
Write-Host "  CLAUDE.md ->" $claudeTemplate
Write-Host "  .claude/skills ->" $skillsSource
Write-Host "  .codex/skills ->" $skillsSource
