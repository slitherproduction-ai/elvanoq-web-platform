#!/usr/bin/env python3
"""Atualiza o ?v= de todo CSS/JS local referenciado nas páginas de dist/.

A versão é um hash curto do conteúdo do arquivo: todas as páginas passam a
usar o mesmo ?v= para o mesmo arquivo, e ele só muda quando o arquivo muda.

Uso (na raiz do repositório):
    python3 tools/cache-bust.py          # aplica
    python3 tools/cache-bust.py --check  # só verifica (sai com 1 se houver diferença)
"""
import hashlib
import pathlib
import re
import sys

DIST = pathlib.Path(__file__).resolve().parent.parent / "dist"
REF = re.compile(r'((?:href|src)=")(/[^"?#]+\.(?:css|js))(?:\?v=[^"]*)?(")')


def version(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def main() -> int:
    check = "--check" in sys.argv
    cache: dict[str, str] = {}
    changed = []
    for page in sorted(DIST.rglob("*.html")):
        text = page.read_text(encoding="utf-8")

        def repl(m: re.Match) -> str:
            url = m.group(2)
            target = DIST / url.lstrip("/")
            if not target.is_file():
                return m.group(0)
            if url not in cache:
                cache[url] = version(target)
            return f"{m.group(1)}{url}?v={cache[url]}{m.group(3)}"

        new = REF.sub(repl, text)
        if new != text:
            changed.append(page.relative_to(DIST))
            if not check:
                page.write_text(new, encoding="utf-8")
    for p in changed:
        print(("desatualizado: " if check else "atualizado: ") + str(p))
    return 1 if check and changed else 0


if __name__ == "__main__":
    sys.exit(main())
