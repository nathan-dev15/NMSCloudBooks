$ErrorActionPreference = "Stop"
$env:DEBUG = "false"
Set-Location -LiteralPath "D:\shanprojects\NMSCloudBooks\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
