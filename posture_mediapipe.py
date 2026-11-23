"""MaternalAI - Durus analizi (MediaPipe Pose)

Kurulum (Python 3.9-3.12):
    pip install mediapipe==0.10.14 opencv-python numpy pyserial

Calistirma:
    python posture_mediapipe.py                       # kamera 0
    python posture_mediapipe.py --cam 1               # ikinci kamera (DroidCam, Iriun, Camo vb. de buradan gelir)
    python posture_mediapipe.py --cam http://192.168.1.20:4747/video   # telefon / IP kamera
    python posture_mediapipe.py --port COM5           # uyari durumunda Deneyap'a V1/V0 gonder

Tuslar:  c = dik otururken kalibrasyon (ONEMLI, once bunu yapin)   q = cikis
"""
import argparse
import csv
import math
import os
import time

import cv2
import mediapipe as mp

ap = argparse.ArgumentParser()
ap.add_argument("--cam", default="0")
ap.add_argument("--thr", type=float, default=15.0, help="uyari esigi (derece)")
ap.add_argument("--hold", type=float, default=3.0, help="uyari icin gereken sure (sn)")
ap.add_argument("--port", default=None, help="seri port, ornek COM5 veya /dev/ttyUSB0")
a = ap.parse_args()

src = int(a.cam) if a.cam.isdigit() else a.cam
cap = cv2.VideoCapture(src, cv2.CAP_DSHOW) if isinstance(src, int) and os.name == "nt" else cv2.VideoCapture(src)
if not cap.isOpened():
    raise SystemExit("Kamera acilamadi. --cam 1 veya 2 deneyin.")

ser = None
if a.port:
    import serial
    ser = serial.Serial(a.port, 115200, timeout=0.1)
    time.sleep(2)

mpp = mp.solutions.pose
L = mpp.PoseLandmark
pose = mpp.Pose(model_complexity=1, smooth_landmarks=True,
                min_detection_confidence=0.5, min_tracking_confidence=0.5)

log = open("posture_log.csv", "w", newline="", encoding="utf-8")
w = csv.writer(log)
w.writerow(["sn", "mod", "ham_aci", "sapma", "durum"])


def mid(wl, i, j):
    return [(wl[i].x + wl[j].x) / 2, (wl[i].y + wl[j].y) / 2, (wl[i].z + wl[j].z) / 2]


def raw_angle(upper, lower):
    """Alt noktadan ust noktaya giden vektorun dikeyle yaptigi aci (y-z duzleminde)."""
    dy = upper[1] - lower[1]          # MediaPipe'ta y asagi dogru
    dz = upper[2] - lower[2]
    return math.degrees(math.atan2(dz, -dy))


base = {"govde": None, "boyun": None}
ema, bad, since, t0 = None, False, None, time.time()
cur_mode, raw = "boyun", 0.0

while True:
    ok, frame = cap.read()
    if not ok:
        break
    frame = cv2.flip(frame, 1)
    res = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    dev, state = None, "KISI YOK"

    if res.pose_world_landmarks:
        wl = res.pose_world_landmarks.landmark
        hips_vis = min(res.pose_landmarks.landmark[L.LEFT_HIP].visibility,
                       res.pose_landmarks.landmark[L.RIGHT_HIP].visibility)
        sh = mid(wl, L.LEFT_SHOULDER, L.RIGHT_SHOULDER)
        if hips_vis > 0.5:      # kalcalar gorunuyorsa govde acisi
            cur_mode, raw = "govde", raw_angle(sh, mid(wl, L.LEFT_HIP, L.RIGHT_HIP))
        else:                   # masa basinda genelde kalca gorunmez: boyun acisi
            cur_mode, raw = "boyun", raw_angle(mid(wl, L.LEFT_EAR, L.RIGHT_EAR), sh)

        if base[cur_mode] is None:
            state = "KALIBRASYON: dik oturup 'c' basin"
        else:
            d = abs(raw - base[cur_mode])
            ema = d if ema is None else 0.8 * ema + 0.2 * d      # yumusatma
            dev = ema
            now = time.time()
            if dev > a.thr:
                since = since or now
                if now - since >= a.hold:
                    bad = True
            elif dev < a.thr - 3:   # histerezis
                since, bad = None, False
            state = "UYARI: one egilme" if bad else "Dik oturus"
            if ser:
                ser.write(b"V1\n" if bad else b"V0\n")
            w.writerow([round(now - t0, 2), cur_mode, round(raw, 1), round(dev, 1), state])

        mp.solutions.drawing_utils.draw_landmarks(frame, res.pose_landmarks, mpp.POSE_CONNECTIONS)

    color = (0, 0, 255) if bad else (0, 200, 0)
    cv2.putText(frame, f"Mod: {cur_mode}", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    if dev is not None:
        cv2.putText(frame, f"Sapma: {dev:.1f} derece (esik {a.thr:.0f})", (10, 58),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    cv2.putText(frame, state, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
    cv2.imshow("MaternalAI - Durus", frame)

    k = cv2.waitKey(1) & 0xFF
    if k == ord("q"):
        break
    if k == ord("c") and res.pose_world_landmarks:
        base[cur_mode] = raw
        ema, since, bad = None, None, False
        print(f"Kalibrasyon ({cur_mode}): {raw:.1f} derece")

if ser:
    ser.write(b"V0\n")
    ser.close()
cap.release()
log.close()
cv2.destroyAllWindows()
