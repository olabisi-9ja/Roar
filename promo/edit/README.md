# Promo edit (Remotion)

`src/Ad.tsx` is the whole 80 s cut: timeline in `T`, sound at the bottom. Rebuild `public/` before rendering:

1. Stock: download each source in `cuts.txt` (Mixkit `https://assets.mixkit.co/videos/<id>/<id>-720.mp4`;
   Pixabay ids via the Pixabay API with the owner's key) into `mk/` and `px/`, then for each line
   `ffmpeg -nostdin -ss <start> -t <dur> -i <src> -an -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30" public/clips/<name>.mp4`.
2. App recordings: copy `../footage/app/{cap_crowd,feed,sos2_fan,sos2_room,adm_curate}.mp4` to `public/app/`.
3. Audio: music Mixkit 31 "Dreaming Big" → `public/audio/music.mp3`; SFX Mixkit ids 2111, 462, 3022, 363, 494, 1492, 2918, 614
   (`https://assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3`) → `public/audio/sfx_<id>.mp3`.
4. Fonts: copy `anton-latin-400-normal.woff2` and `barlow-condensed-latin-{600,800}-normal.woff2` from the @fontsource packages to `public/fonts/`.
5. `npm i && npm run render` (in the cloud container add `--browser-executable=/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`).
