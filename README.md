# Bible Scriptorium

## Submodules

This project includes the [`jadenzaleski/bible-translations`](https://github.com/jadenzaleski/bible-translations) repository as a Git submodule at `bible-translations/`.

### Cloning With Submodules

```bash
git clone <this-repo-url>
cd BibleScriptorium
git submodule update --init --recursive
```

### Updating the Submodule

To pull the latest changes from the upstream translation repository:

```bash
cd bible-translations
git checkout main
git pull origin main
cd ..
git add bible-translations
git commit -m "Update bible-translations submodule"
```

### Changing the Tracked Commit

If you check out a different commit in `bible-translations`, remember to stage the submodule pointer:

```bash
cd bible-translations
git checkout <commit-or-tag>
cd ..
git add bible-translations
git commit -m "Point submodule to <commit-or-tag>"
```
