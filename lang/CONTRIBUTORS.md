# Localization contributor credits

The `!event language credits` / `!событие язык авторы` response is generated from metadata at the top of each locale file. The locale files are the single source of truth; do not maintain a second list of names here.

Use this format:

```text
# Language: English
# Contributor: preferred display name
# Contributor: another contributor
```

- `Language` is required and should be the language's display name.
- Each `Contributor` line adds one credit. Multiple lines are supported.
- Contributor credits are optional. Add a name or pseudonym only after that person has agreed to be listed.
- Omit all `Contributor` lines when nobody has opted in.
- After editing locale metadata, run `npm run check:lang`.

The contributor name indicates an opt-in localization credit; it does not claim exclusive authorship of every translated phrase.
