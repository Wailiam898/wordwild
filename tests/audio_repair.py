"""Exact twelve-clip regression: assets, decodability, scope, and cache invalidation.
Run with .venv/Scripts/python.exe -I tests/audio_repair.py
This verifies deployment integrity, NOT subjective pronunciation.
"""
import hashlib,json,subprocess,unittest
from pathlib import Path
R=Path(__file__).resolve().parents[1]
IDS='w_am w_an w_bat w_bean w_bee w_by w_her w_sat pw_bat pw_bean pw_bee s_pip_0'.split()
STAGED=R/'work/repair_v2/final'
B=Path((R/'work/repair_v2/backup_path.txt').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
class AudioRepair(unittest.TestCase):
 def test_all_twelve_replacements_installed(self):
    for cid in IDS:
      with self.subTest(clip=cid):
        p=R/'app/audio'/f'{cid}.mp3'
        self.assertEqual(sha(p),sha(STAGED/p.name),'Replacement not installed')
        self.assertNotEqual(sha(p),sha(B/p.name),'Still original faulty take')
 def test_no_unrequested_audio_changed(self):
    old=json.loads((B/'all_audio_hashes.json').read_text())
    current={p.name:sha(p) for p in (R/'app/audio').glob('*.mp3')}
    changed={k for k in old.keys()|current.keys() if old.get(k)!=current.get(k)}
    self.assertEqual(changed,{i+'.mp3' for i in IDS})
 def test_replacement_mp3s_decode(self):
    for cid in IDS:
      with self.subTest(clip=cid):
        p=R/'app/audio'/f'{cid}.mp3'
        raw=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ar','24000','-ac','1','-'],capture_output=True,check=True).stdout
        duration=len(raw)/4/24000
        self.assertGreater(duration,.2)
        self.assertLess(duration,1.5)
 def test_offline_cache_changed(self):
    self.assertNotEqual((R/'app/sw.js').read_bytes(),(B/'sw.js').read_bytes(),'Offline cache still serves old audio')
if __name__=='__main__': unittest.main(verbosity=2)
