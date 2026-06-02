@echo off
cd /d "%~dp0java"
call mvn -q package
if errorlevel 1 (
  echo Maven build failed. Install JDK 11+ and Maven, then retry.
  exit /b 1
)
echo Built: %~dp0java\target\jrxml-local-runner.jar
