"""
Sequential Dataset Renaming and Metadata Generator
Standardizes all images and patient IDs into sequential format:
Images: 00000001_000.png, 00000002_000.png, ..., 00000119_000.png
Patient IDs: PAT-2026-0001, PAT-2026-0002, ..., PAT-2026-0119
"""
import os
import csv
import json
import shutil
from PIL import Image

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET_DIR = os.path.join(BASE_DIR, "demo_data", "datasets", "NIH_ChestXray14")
IMAGES_DIR = os.path.join(DATASET_DIR, "images")
LABELS_PATH = os.path.join(DATASET_DIR, "labels.csv")
DEMO_IMAGES_DIR = os.path.join(BASE_DIR, "demo_data", "processed", "demo_images")
TRAIN_DIR = os.path.join(BASE_DIR, "demo_data", "processed", "train")
VAL_DIR = os.path.join(BASE_DIR, "demo_data", "processed", "validation")
TEST_DIR = os.path.join(BASE_DIR, "demo_data", "processed", "test")

def sequence_dataset():
    print("[1/4] Reading existing labels and image files...")
    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        existing_rows = list(reader)

    print(f"  Found {len(existing_rows)} rows in labels.csv")

    # Order rows: keep 00000001_000.png first, 00027426_000.png second, then remaining
    sorted_rows = []
    first_row = next((r for r in existing_rows if r["Image Index"] == "00000001_000.png"), None)
    second_row = next((r for r in existing_rows if r["Image Index"] == "00027426_000.png"), None)
    if first_row:
        sorted_rows.append(first_row)
    if second_row:
        sorted_rows.append(second_row)

    for r in existing_rows:
        if r["Image Index"] not in ("00000001_000.png", "00027426_000.png"):
            sorted_rows.append(r)

    print(f"[2/4] Formatting {len(sorted_rows)} images into sequential format 00000001_000.png to 00000{len(sorted_rows):03d}_000.png...")
    sequential_records = []

    for idx, row in enumerate(sorted_rows, start=1):
        seq_img_name = f"{idx:08d}_000.png"
        seq_pat_id = f"PAT-2026-{idx:04d}"

        old_fname = row["Image Index"]
        old_path = os.path.join(IMAGES_DIR, old_fname)
        new_path = os.path.join(IMAGES_DIR, seq_img_name)

        if os.path.exists(old_path):
            # Convert / save to PNG if not already
            if old_fname != seq_img_name:
                try:
                    with Image.open(old_path) as img:
                        img.convert("RGB").save(new_path, "PNG")
                except Exception as e:
                    shutil.copy2(old_path, new_path)
            else:
                pass
        
        sequential_records.append({
            "filename": seq_img_name,
            "original_filename": old_fname,
            "finding": row.get("Finding Labels", "Pneumonia"),
            "followup": 0,
            "patient_id": seq_pat_id,
            "age": row.get("Patient Age", "50"),
            "gender": row.get("Patient Gender", "M"),
            "view": row.get("View Position", "PA"),
        })

    print("[3/4] Writing sequential labels.csv...")
    with open(LABELS_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Image Index", "Finding Labels", "Follow-up #", "Patient ID", "Patient Age", "Patient Gender", "View Position"])
        for r in sequential_records:
            writer.writerow([
                r["filename"],
                r["finding"],
                r["followup"],
                r["patient_id"],
                r["age"],
                r["gender"],
                r["view"],
            ])

    # Also update metadata.json
    meta_json_path = os.path.join(DATASET_DIR, "metadata.json")
    if os.path.exists(meta_json_path):
        with open(meta_json_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        meta["total_images"] = len(sequential_records)
        meta["ordering"] = "sequential (00000001_000.png to 00000119_000.png / PAT-2026-0001 to PAT-2026-0119)"
        with open(meta_json_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

    print("[4/4] Updating demo vault with sequential scans...")
    for d in [DEMO_IMAGES_DIR, TRAIN_DIR, VAL_DIR, TEST_DIR]:
        os.makedirs(d, exist_ok=True)

    for r in sequential_records:
        src = os.path.join(IMAGES_DIR, r["filename"])
        shutil.copy2(src, os.path.join(DEMO_IMAGES_DIR, r["filename"]))

    print(f"[SUCCESS] Sequenced {len(sequential_records)} images:")
    for r in sequential_records[:5]:
        print(f"  {r['filename']} -> {r['patient_id']} | {r['finding']} | {r['view']}")
    print("  ...")
    for r in sequential_records[98:103]:
        print(f"  {r['filename']} -> {r['patient_id']} | {r['finding']} | {r['view']}")

if __name__ == "__main__":
    sequence_dataset()
