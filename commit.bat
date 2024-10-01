@echo off
set /p message=Commit Message: 
git add --all
git commit -m "%message%"
git push -u origin main