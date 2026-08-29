# Pushing TaskFlow to GitHub

1. Open a terminal right inside this `Task-Dashboard` folder
   (the one with `index.html`, `.gitignore`, etc.).

2. Run these commands one by one:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: TaskFlow personal productivity dashboard"
   ```

3. Create a new EMPTY repository on GitHub (no README/.gitignore
   template — you already have one). Copy the repo URL it gives you,
   then run:

   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

That's it — your dashboard is on GitHub. Since everything runs
offline via `index.html`, you can also enable **GitHub Pages**
(Settings → Pages → Deploy from branch → main → /root) to get a free
live link to the dashboard.
