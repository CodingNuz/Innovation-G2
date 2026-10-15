from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

FRONTEND = Path(__file__).resolve().parents[1] / "frontend"

app = FastAPI()


@app.get("/")
async def index():
    return FileResponse(FRONTEND / "spamchameleon.html")


# Mount last: StaticFiles at "/" must not shadow the "/" route above.
app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3000)
