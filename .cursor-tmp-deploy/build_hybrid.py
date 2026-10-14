import json
from pathlib import Path

uploaded = {
    "72cb6445738e340b044ee63fdde0b19250c7b414",
    "391948a924e02d1a0313d745374aa89bc431b4c1",
    "5458e80c18753dec1fcfdd1dc67c13683809f75f",
    "7b5bae8aeb38d1bc39c02123c183b6fd755a7642",
    "256c08febeed0b1777856dc353e964a34eae6bbc",
    "568e794eda4aa8222f21b76da82d8ebd6167356f",
    "45129a7abaea669a071ecf518ef75f33b85be0c7",
    "67d65b4d801b18c17e07609a6573f1de79d1fa48",
    "06e5b053de5e90cae065a2ac8a57758316aeb8ea",
    "31ef94535c5ab66ec2b0df047c3b285a79ff4820",
    "45d4c1b64bfd41f0c5742ea59c821ed43ebd20fd",
    "8eaa26ff104d69e11725cf4344cd4126b440f6bc",
    "8c8c1e48f2552c7924f77bcbd6ba4f3409f54379",
    "c6c5b337464cd0d6c52c5b1e51850592cd590429",
    "08749bccb2e10a35528610b8fa44d380d4b109f5",
}

m = json.loads(Path("/tmp/vfiles/manifest.json").read_text())
missing = [x for x in m if x["sha"] not in uploaded]
print("missing count", len(missing))
for x in missing:
    print(x["idx"], x["size"], x["file"], x["sha"])

files = []
for x in m:
    if x["sha"] in uploaded:
        files.append({"file": x["file"], "sha": x["sha"], "size": x["size"]})
    else:
        data = Path(f"/tmp/vfiles/{x['idx']}.data").read_text("utf-8")
        files.append({"file": x["file"], "data": data, "encoding": "utf-8"})

body = {
    "name": "myntmore-linkedin-hook-grader",
    "project": "prj_Vh57c0R27P2WRIaW52yq86vIUx1z",
    "target": "production",
    "files": files,
    "projectSettings": {
        "framework": "nextjs",
        "buildCommand": "npm run build",
        "installCommand": "npm install",
        "nodeVersion": "20.x",
    },
}
out = Path("/tmp/vfiles/deploy-hybrid.json")
out.write_text(json.dumps(body))
print("hybrid bytes", out.stat().st_size)

files2 = [f for f in files if f["file"] != "README.md"]
body2 = dict(body)
body2["files"] = files2
out2 = Path("/tmp/vfiles/deploy-hybrid-noreadme.json")
out2.write_text(json.dumps(body2))
print("no readme bytes", out2.stat().st_size)

# Copy into workspace for MCP create_deployment to load via shell later
ws = Path("/home/gaurav/Desktop/myntmore assignment/.cursor-tmp-deploy")
(ws / "deploy-hybrid-noreadme.json").write_text(json.dumps(body2))
print("wrote workspace copy")
