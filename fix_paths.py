import os
import re

def repl_file(path, old, new):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

# Root files
repl_file('index.html', 'src="app.js"', 'src="js/app.js"')
repl_file('auth.html', 'src="app.js"', 'src="js/app.js"')
repl_file('auth.html', 'src="auth.js"', 'src="js/auth.js"')

# JS files
repl_file('js/auth.js', '-dashboard.html', 'dashboards/-dashboard.html')
repl_file('js/app.js', 'window.location.href = \'auth.html\';', 'window.location.href = window.location.pathname.endswith(\\\'auth.html\\\') || window.location.pathname.endswith(\\\'index.html\\\') ? \\\'auth.html\\\' : \\\'../auth.html\\\';')
repl_file('js/donor-dashboard.js', 'window.location.href = \'auth.html\';', 'window.location.href = \'../auth.html\';')
repl_file('js/receiver-dashboard.js', 'window.location.href = \'auth.html\';', 'window.location.href = \'../auth.html\';')
repl_file('js/volunteer-dashboard.js', 'window.location.href = \'auth.html\';', 'window.location.href = \'../auth.html\';')

# HTML Dashboards
for p in ['dashboards/donor-dashboard.html', 'dashboards/receiver-dashboard.html', 'dashboards/volunteer-dashboard.html']:
    repl_file(p, 'href="styles.css"', 'href="../styles.css"')
    repl_file(p, 'href="index.html"', 'href="../index.html"')
    repl_file(p, 'src="app.js"', 'src="../js/app.js"')
    dl = os.path.basename(p).replace(".html", ".js")
    repl_file(p, f'src="{dl}"', f'src="../js/{dl}"')

print('Done reorganizing and updating paths!')
