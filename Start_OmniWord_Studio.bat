@echo off
title OmniWord Studio — Companion Server
echo Starting OmniWord Studio backend on http://127.0.0.1:5000 ...
start "" http://127.0.0.1:5000
python server.py
pause
