<p align="center">
  <a href="https://docs.omnilearn.app">
    <img alt="OmniLearn" src=".github/images/omnilearn-github.png" width="600" />
  </a>
</p>

<p align="center">
  <strong>OmniLearn Documentation</strong>
</p>

<p align="center">
  Official documentation for <a href="https://omnilearn.app">OmniLearn</a>, the open-source learning management system.
</p>

<p align="center">
  <a href="https://docs.omnilearn.app">docs.omnilearn.app</a>
</p>

---

## Local Development

This site lives in the [`omnilearn/omnilearn`](https://github.com/omnilearn/omnilearn)
monorepo under `docs/`. Run all commands from that directory.

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
# Clone the monorepo and move into the docs app
git clone https://github.com/omnilearn/omnilearn.git
cd omnilearn/docs

# Install dependencies
bun install

# Start the dev server
bun dev
```

The site will be available at `http://localhost:3000`.

## Project Structure

```
content/          # MDX documentation pages
  getting-started/
  platform/
  self-hosting/
  developers/
  enterprise/
  cli/
app/              # Next.js App Router
components/       # React components
public/           # Static assets
scripts/          # Build scripts
```

## Built With

- [Next.js](https://nextjs.org)
- [Nextra](https://nextra.site)
- [Tailwind CSS](https://tailwindcss.com)

## License

MIT - see [LICENSE](LICENSE) for details.
