import json

with open("data/project.json", "r", encoding="utf-8") as f:
    data = json.load(f)

TS = "2026-02-19T06:00:00.000Z"

entries = {
    "line-flagor-ascension": (0.9, 0.95, "active", "active",
        "Retourne dans les vestiges. Choix actif. 'Huit heures. C'est assez.'"),
    "line-guerre": (0.8, 0.85, "active", "active",
        "Delegation en approche. Kira atterrit au nord. Convergence physique."),
    "line-passe-flagor": (0.75, 0.8, "climax", "climax",
        "Syra moteur du retour. Le passe dicte le mouvement."),
    "line-astre-eteint": (0.65, 0.7, "active", "active",
        "Convergence totale : Soren, Flagor, delegation Biomen sur le meme sol."),
    "line-biomen": (0.85, 0.9, "active", "active",
        "Kira dans la delegation. Instructions d'Helena. Atterrit au nord."),
    "line-bamboule": (0.8, 0.85, "active", "active",
        "Soren franchit l'ouverture. Pierre froide. Reseau annonce la delegation."),
    "line-oligarchie": (0.75, 0.8, "active", "active",
        "Helena agit via delegation. Instructions verbales, pas ecrites."),
    "line-message-ils-savent": (0.35, 0.35, "active", "active",
        "Reseau envoie : delegation en route. Heures, pas jours."),
    "line-vestiges-astre": (0.65, 0.7, "resolving", "resolving",
        "Vestiges retires. Mur ouvert. Lumiere faiblit. Aux humains de choisir.")
}

for line in data["narrativeLines"]:
    lid = line["id"]
    if lid in entries:
        wb, wa, sb, sa, note = entries[lid]
        line["weight"] = wa
        line["lastAdvancedInUnit"] = 19
        line["updatedAt"] = TS
        has = any(h.get("unitId") == "unit-ch19" for h in line.get("history", []))
        if not has:
            line["history"].append({
                "unitId": "unit-ch19",
                "unitNumber": 19,
                "note": note,
                "weightBefore": wb,
                "weightAfter": wa,
                "statusBefore": sb,
                "statusAfter": sa
            })

has_ch19 = any(u.get("id") == "unit-ch19" for u in data["storyUnits"])
if not has_ch19:
    data["storyUnits"].append({
        "id": "unit-ch19",
        "type": "chapter",
        "number": 19,
        "title": "La convergence",
        "status": "completed",
        "content": "[See chapter text file]",
        "summary": "Soren franchit le mur ouvert. Reseau annonce delegation. Flagor retourne aux vestiges. Kira atterrit au nord. Convergence totale.",
        "advancedLines": list(entries.keys()),
        "preEvaluation": None,
        "postEvaluation": None,
        "createdAt": TS,
        "updatedAt": TS
    })

for p in data.get("promises", []):
    pid = p["id"]
    r = p.get("reinforcedInChapters", [])
    if pid in ("promise-kira-verdict", "promise-helena-plan",
               "promise-reseau-anonyme", "promise-syra-identity"):
        if 19 not in r:
            r.append(19)

for tq in data.get("thematicQuestions", []):
    has19 = any(c.get("unitNumber") == 19 for c in tq.get("contributions", []))
    if has19:
        continue
    notes = {
        "tq-pouvoir-performance": "Flagor : pouvoir comme retour. Kira : 'Au nord' - premier acte d'autorite.",
        "tq-dignite-systeme": "Soren franchit le mur. Dignite comme occupation d'un espace non destine. Kira : dignite retrouvee.",
        "tq-guerre-instrumentalisee": "Helena envoie sans protocole ecrit. Kira atterrit pres des vestiges - mission echappe au plan."
    }
    if tq["id"] in notes:
        tq["contributions"].append({"unitNumber": 19, "note": notes[tq["id"]]})

data["updatedAt"] = TS

with open("data/project.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("OK - project.json updated")
for line in data["narrativeLines"]:
    print(f"  {line['id']}: w={line['weight']}, last={line['lastAdvancedInUnit']}")
print(f"StoryUnits: {len(data['storyUnits'])}, last={data['storyUnits'][-1]['title']}")
