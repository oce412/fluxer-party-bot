# Localization contributor credits

Contributor attribution is shown automatically when an administrator changes a community's language. The message is translated using the newly selected locale; an optional footer lists contributors from that locale's metadata.

The locale files are the single source of truth. Use this format at the top of a `.lang` file:

```text
# Language: English
# Contributor: preferred display name
# Contributor: another contributor
```

- `Language` is required and should be the language's display name.
- Each `Contributor` line adds one credit. Multiple lines are supported.
- Contributor credits are optional. Add a name or pseudonym only after that person has agreed to be listed.
- Omit all `Contributor` lines when nobody has opted in.
- No translation key is needed for contributor names; they are appended verbatim to the language-change confirmation.
- After editing locale metadata, run `npm run check:lang`.

The contributor name indicates an opt-in localization credit; it does not claim exclusive authorship of every translated phrase.
